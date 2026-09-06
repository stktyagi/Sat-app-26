package cache

import (
	"context"
	"sync"
	"time"
)

// Memory is an in-process Provider and Bus.
//
// It is not a runtime fallback: Redis is a hard requirement, and falling back
// to a per-process cache would silently reintroduce exactly the stale-view
// problem the shared tier exists to solve. It exists so the event cache can be
// exercised without a server.
type Memory struct {
	mu      sync.RWMutex
	entries map[string]memEntry
	subs    map[string][]chan []byte
	closed  bool
}

type memEntry struct {
	val []byte
	// expiresAt zero means the entry never expires.
	expiresAt time.Time
}

func NewMemory() *Memory {
	return &Memory{
		entries: map[string]memEntry{},
		subs:    map[string][]chan []byte{},
	}
}

func (m *Memory) Get(_ context.Context, key string) ([]byte, error) {
	m.mu.RLock()
	e, ok := m.entries[key]
	m.mu.RUnlock()

	if !ok || e.expired(time.Now()) {
		return nil, ErrMiss
	}
	// Copy out, so a caller mutating the slice cannot corrupt the entry.
	out := make([]byte, len(e.val))
	copy(out, e.val)
	return out, nil
}

func (m *Memory) Set(_ context.Context, key string, value []byte, ttl time.Duration) error {
	stored := make([]byte, len(value))
	copy(stored, value)

	e := memEntry{val: stored}
	if ttl > 0 {
		e.expiresAt = time.Now().Add(ttl)
	}

	m.mu.Lock()
	m.entries[key] = e
	m.mu.Unlock()
	return nil
}

func (m *Memory) Delete(_ context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	m.mu.Lock()
	for _, k := range keys {
		delete(m.entries, k)
	}
	m.mu.Unlock()
	return nil
}

// Publish sends without blocking, matching Redis pub/sub: a subscriber that is
// not reading loses the message rather than stalling the publisher. The event
// cache tolerates that — a dropped invalidation costs staleness bounded by the
// TTL, not a wedged write path.
func (m *Memory) Publish(_ context.Context, channel string, payload []byte) error {
	m.mu.RLock()
	subs := append([]chan []byte(nil), m.subs[channel]...)
	m.mu.RUnlock()

	for _, ch := range subs {
		msg := make([]byte, len(payload))
		copy(msg, payload)
		select {
		case ch <- msg:
		default:
		}
	}
	return nil
}

func (m *Memory) Subscribe(ctx context.Context, channel string) (<-chan []byte, error) {
	ch := make(chan []byte, 16)

	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		close(ch)
		return ch, nil
	}
	m.subs[channel] = append(m.subs[channel], ch)
	m.mu.Unlock()

	go func() {
		<-ctx.Done()
		m.unsubscribe(channel, ch)
	}()
	return ch, nil
}

func (m *Memory) unsubscribe(channel string, ch chan []byte) {
	m.mu.Lock()
	defer m.mu.Unlock()

	subs := m.subs[channel]
	for i, c := range subs {
		if c != ch {
			continue
		}
		m.subs[channel] = append(subs[:i:i], subs[i+1:]...)
		close(ch)
		return
	}
}

func (m *Memory) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.closed {
		return nil
	}
	m.closed = true
	for channel, subs := range m.subs {
		for _, ch := range subs {
			close(ch)
		}
		delete(m.subs, channel)
	}
	return nil
}

func (e memEntry) expired(now time.Time) bool {
	return !e.expiresAt.IsZero() && now.After(e.expiresAt)
}
