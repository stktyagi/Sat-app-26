package store

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"golang.org/x/sync/singleflight"

	"backend/internal/cache"
	"backend/internal/models"
)

// Shared cache keys. The provider namespaces them, so these stay bare.
const (
	keyEvents      = "events:all"
	keyCounts      = "events:counts"
	chanInvalidate = "events:invalidate"
)

const (
	// invalidateTimeout bounds the shared work Invalidate does after a write
	// that has already committed.
	invalidateTimeout = 5 * time.Second
	// subscribeRetry is how long the listener waits before resubscribing.
	subscribeRetry = 2 * time.Second
)

// eventSource is everything the cache needs out of Firestore. *Store satisfies
// it, and so does a stub, which is what lets the cache be exercised in tests
// without a live Firestore.
type eventSource interface {
	AllEvents(ctx context.Context) ([]*models.Event, error)
	CountAllRegistrations(ctx context.Context) (map[string]int, error)
	GetEvent(ctx context.Context, id string) (*models.Event, error)
	CountRegistrations(ctx context.Context, eventID string) (int, error)
}

// EventCache holds every event document plus a per-event registration count,
// in two tiers.
//
// L1 is this process's decoded slice, and it has to exist. Firestore cannot do
// substring matching, so GET /events filters, searches, sorts and pages the
// slice in Go, which needs the events in local memory. Holding the whole
// collection also avoids a searchKeywords array and a registeredCount field on
// every document — a backfill over existing data, four composite indexes, and
// a counter that can drift — and buys a real substring search instead of the
// whole-word-only match an array-contains query would give. A fest has well
// under a thousand events.
//
// L2 is Redis, shared by every instance. It holds the same snapshot plus the
// counts, so a cold instance does not repeat the full collection scan — the
// counts scan reads every registration document, and that grows with signups —
// and it carries an invalidation channel that drops every instance's L1 at
// once. Without that channel an admin editing an event on one instance would
// leave the others serving stale data until their own TTL turned over.
type EventCache struct {
	store eventSource
	l2    cache.Provider
	bus   cache.Bus
	ttl   time.Duration

	// id identifies this process on the invalidation channel, so an instance
	// ignores the broadcast it sent itself.
	id string

	// sf collapses a cold-start stampede: without it every concurrent request
	// on an empty cache runs the whole load.
	sf singleflight.Group

	mu       sync.RWMutex
	events   []*models.Event
	byID     map[string]*models.Event
	counts   map[string]int
	loadedAt time.Time
}

func NewEventCache(s eventSource, l2 cache.Provider, bus cache.Bus, ttl time.Duration) *EventCache {
	return &EventCache{
		store:  s,
		l2:     l2,
		bus:    bus,
		ttl:    ttl,
		id:     uuid.NewString(),
		byID:   map[string]*models.Event{},
		counts: map[string]int{},
	}
}

// Invalidate drops this instance's copy, deletes the shared snapshot and tells
// every other instance to do the same. Called after every admin write and
// after any registration change, so counts stay accurate without waiting out
// the TTL.
//
// It reports nothing on purpose. It runs after a Firestore write that has
// already committed, so failing the request here would make a client retry a
// create that already succeeded. Failures are logged instead, and staleness
// stays bounded by the TTL on the shared keys.
func (c *EventCache) Invalidate() {
	c.clearLocal()

	ctx, cancel := context.WithTimeout(context.Background(), invalidateTimeout)
	defer cancel()

	if err := c.l2.Delete(ctx, keyEvents, keyCounts); err != nil {
		log.Printf("cache: deleting the shared snapshot: %v", err)
	}
	if err := c.bus.Publish(ctx, chanInvalidate, []byte(c.id)); err != nil {
		log.Printf("cache: publishing the invalidation: %v", err)
	}
}

// StartInvalidationListener clears this instance's L1 whenever another
// instance invalidates.
//
// The first subscribe is synchronous, so that once this returns the instance
// is genuinely receiving. Doing it inside the goroutine would leave a startup
// window in which a broadcast is missed and this instance serves a stale copy
// until its TTL. Only the consume-and-resubscribe loop is backgrounded.
func (c *EventCache) StartInvalidationListener(ctx context.Context) {
	msgs, err := c.bus.Subscribe(ctx, chanInvalidate)
	if err != nil {
		log.Printf("cache: subscribing to invalidations: %v", err)
		msgs = nil
	}
	go c.listenForInvalidations(ctx, msgs)
}

func (c *EventCache) listenForInvalidations(ctx context.Context, msgs <-chan []byte) {
	for {
		// Ranging a nil channel would block forever, so a failed subscribe
		// falls straight through to the retry below.
		if msgs != nil {
			for msg := range msgs {
				// Our own broadcast: L1 is already cleared and the shared keys
				// are already gone.
				if string(msg) == c.id {
					continue
				}
				c.clearLocal()
			}
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(subscribeRetry):
		}

		next, err := c.bus.Subscribe(ctx, chanInvalidate)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("cache: resubscribing to invalidations: %v", err)
			next = nil
		}
		msgs = next
	}
}

func (c *EventCache) clearLocal() {
	c.mu.Lock()
	c.loadedAt = time.Time{}
	c.mu.Unlock()
}

// fresh must be called with c.mu held.
func (c *EventCache) fresh() bool {
	return !c.loadedAt.IsZero() && time.Since(c.loadedAt) < c.ttl
}

func (c *EventCache) stale() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return !c.fresh()
}

func (c *EventCache) refresh(ctx context.Context) error {
	if !c.stale() {
		return nil
	}

	_, err, _ := c.sf.Do("events", func() (any, error) {
		// A concurrent caller may have loaded while this one waited.
		if !c.stale() {
			return nil, nil
		}

		events, counts, err := c.loadShared(ctx)
		if err != nil {
			return nil, err
		}
		if events == nil {
			if events, counts, err = c.loadSource(ctx); err != nil {
				return nil, err
			}
		}

		c.populate(events, counts)
		return nil, nil
	})
	return err
}

// loadShared reads the snapshot out of L2, reporting nil events on a miss.
//
// A transport error is returned rather than treated as a miss. Redis is a hard
// requirement, so a failing cache surfaces as a 500 instead of quietly falling
// through and hammering Firestore on every request. A snapshot that is present
// but unreadable is a different matter: that counts as a miss, and the reload
// overwrites it.
func (c *EventCache) loadShared(ctx context.Context) ([]*models.Event, map[string]int, error) {
	rawEvents, err := c.l2.Get(ctx, keyEvents)
	if err != nil {
		if errors.Is(err, cache.ErrMiss) {
			return nil, nil, nil
		}
		return nil, nil, err
	}

	rawCounts, err := c.l2.Get(ctx, keyCounts)
	if err != nil {
		if errors.Is(err, cache.ErrMiss) {
			return nil, nil, nil
		}
		return nil, nil, err
	}

	var events []*models.Event
	if err := json.Unmarshal(rawEvents, &events); err != nil {
		log.Printf("cache: discarding an unreadable event snapshot: %v", err)
		return nil, nil, nil
	}
	counts := map[string]int{}
	if err := json.Unmarshal(rawCounts, &counts); err != nil {
		log.Printf("cache: discarding unreadable counts: %v", err)
		return nil, nil, nil
	}

	for _, e := range events {
		e.Normalise()
	}
	return events, counts, nil
}

func (c *EventCache) loadSource(ctx context.Context) ([]*models.Event, map[string]int, error) {
	events, err := c.store.AllEvents(ctx)
	if err != nil {
		return nil, nil, err
	}
	counts, err := c.store.CountAllRegistrations(ctx)
	if err != nil {
		return nil, nil, err
	}

	c.writeShared(ctx, events, counts)
	return events, counts, nil
}

// writeShared publishes the snapshot for the other instances. It is best
// effort: the caller already holds a correct copy, so a failed write costs a
// repeated Firestore scan rather than a failed request.
//
// What goes in are the raw decoded documents, never the output of decorate.
// RegisteredCount, SeatsLeft, RegistrationOpen and EffectiveFee are computed
// per response, and EffectiveFee is per user, so caching a decorated copy
// would serve one caller's pricing to everybody.
func (c *EventCache) writeShared(ctx context.Context, events []*models.Event, counts map[string]int) {
	rawEvents, err := json.Marshal(events)
	if err != nil {
		log.Printf("cache: encoding the event snapshot: %v", err)
		return
	}
	rawCounts, err := json.Marshal(counts)
	if err != nil {
		log.Printf("cache: encoding counts: %v", err)
		return
	}

	if err := c.l2.Set(ctx, keyEvents, rawEvents, c.ttl); err != nil {
		log.Printf("cache: writing the event snapshot: %v", err)
	}
	if err := c.l2.Set(ctx, keyCounts, rawCounts, c.ttl); err != nil {
		log.Printf("cache: writing counts: %v", err)
	}
}

func (c *EventCache) populate(events []*models.Event, counts map[string]int) {
	byID := make(map[string]*models.Event, len(events))
	for _, e := range events {
		byID[e.ID] = e
	}

	c.mu.Lock()
	c.events, c.byID, c.counts, c.loadedAt = events, byID, counts, time.Now()
	c.mu.Unlock()
}

// All returns a snapshot of every event, each already carrying its registration
// count and computed seat availability.
func (c *EventCache) All(ctx context.Context) ([]*models.Event, error) {
	if err := c.refresh(ctx); err != nil {
		return nil, err
	}
	c.mu.RLock()
	defer c.mu.RUnlock()

	out := make([]*models.Event, 0, len(c.events))
	for _, e := range c.events {
		out = append(out, c.decorate(e))
	}
	return out, nil
}

// Get falls back to a direct read so an event created moments ago is visible
// even if the cache has not turned over yet.
func (c *EventCache) Get(ctx context.Context, id string) (*models.Event, error) {
	if err := c.refresh(ctx); err != nil {
		return nil, err
	}

	c.mu.RLock()
	e, ok := c.byID[id]
	var decorated *models.Event
	if ok {
		decorated = c.decorate(e)
	}
	c.mu.RUnlock()
	if ok {
		return decorated, nil
	}

	fresh, err := c.store.GetEvent(ctx, id)
	if err != nil {
		return nil, err
	}
	n, err := c.store.CountRegistrations(ctx, fresh.EventID)
	if err != nil {
		return nil, err
	}
	out := fresh.Clone()
	out.RegisteredCount = n
	applySeats(out)
	return out, nil
}

// decorate must be called with c.mu held: it reads c.counts.
func (c *EventCache) decorate(e *models.Event) *models.Event {
	out := e.Clone()
	out.RegisteredCount = c.counts[e.EventID]
	applySeats(out)
	return out
}

func applySeats(e *models.Event) {
	e.RegistrationOpen = e.IsRegistrationOpen(time.Now())
	if e.Unlimited() {
		e.SeatsLeft = nil
		return
	}
	left := e.MaxParticipants - e.RegisteredCount
	if left < 0 {
		left = 0
	}
	e.SeatsLeft = &left
}
