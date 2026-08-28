package store

import (
	"context"
	"sync"
	"time"

	"backend/internal/models"
)

// EventCache holds every event document plus a per-event registration count.
//
// Firestore cannot do substring matching, and the events collection has no
// registration counter. Rather than adding a searchKeywords array and a
// registeredCount field to every document — which would mean a backfill over
// existing data, four composite indexes, and a counter that can drift — the
// whole collection is held in memory and filtered there. A fest has well under
// a thousand events, and this buys a real substring search instead of the
// whole-word-only match an array-contains query would give.
type EventCache struct {
	store *Store
	ttl   time.Duration

	mu       sync.RWMutex
	events   []*models.Event
	byID     map[string]*models.Event
	counts   map[string]int
	loadedAt time.Time
}

func NewEventCache(s *Store, ttl time.Duration) *EventCache {
	return &EventCache{store: s, ttl: ttl, byID: map[string]*models.Event{}, counts: map[string]int{}}
}

// Invalidate forces the next read to reload. Called after every admin write and
// after any registration change, so counts stay accurate without waiting out
// the TTL.
func (c *EventCache) Invalidate() {
	c.mu.Lock()
	c.loadedAt = time.Time{}
	c.mu.Unlock()
}

func (c *EventCache) fresh() bool {
	return !c.loadedAt.IsZero() && time.Since(c.loadedAt) < c.ttl
}

func (c *EventCache) refresh(ctx context.Context) error {
	c.mu.RLock()
	ok := c.fresh()
	c.mu.RUnlock()
	if ok {
		return nil
	}

	events, err := c.store.AllEvents(ctx)
	if err != nil {
		return err
	}
	counts, err := c.store.CountAllRegistrations(ctx)
	if err != nil {
		return err
	}

	byID := make(map[string]*models.Event, len(events))
	for _, e := range events {
		byID[e.ID] = e
	}

	c.mu.Lock()
	c.events, c.byID, c.counts, c.loadedAt = events, byID, counts, time.Now()
	c.mu.Unlock()
	return nil
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
	c.mu.RUnlock()
	if ok {
		return c.decorate(e), nil
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
