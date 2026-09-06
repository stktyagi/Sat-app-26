package store

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"backend/internal/cache"
	"backend/internal/models"
)

func testEvent(id string, maxParticipants int) *models.Event {
	return &models.Event{
		ID:              id,
		EventID:         id,
		Title:           "Event " + id,
		Category:        "Technical",
		EventType:       models.EventTypeIndividual,
		MaxParticipants: maxParticipants,
		IsPublic:        true,
	}
}

// stubSource stands in for *Store, which is the whole reason eventSource is an
// interface: the cache is exercisable with no Firestore behind it.
type stubSource struct {
	mu     sync.Mutex
	events []*models.Event
	counts map[string]int

	allCalls    atomic.Int64
	countCalls  atomic.Int64
	getCalls    atomic.Int64
	singleCalls atomic.Int64

	// lastEventIDs records what CountAllRegistrations was asked for, so a
	// caller that forgets to collect the IDs is caught.
	lastEventIDs []string

	delay time.Duration
	err   error
}

func newStubSource(events ...*models.Event) *stubSource {
	counts := make(map[string]int, len(events))
	for _, e := range events {
		counts[e.EventID] = 0
	}
	return &stubSource{events: events, counts: counts}
}

func (s *stubSource) AllEvents(context.Context) ([]*models.Event, error) {
	s.allCalls.Add(1)
	if s.delay > 0 {
		time.Sleep(s.delay)
	}
	if s.err != nil {
		return nil, s.err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]*models.Event, 0, len(s.events))
	for _, e := range s.events {
		out = append(out, e.Clone())
	}
	return out, nil
}

func (s *stubSource) CountAllRegistrations(_ context.Context, eventIDs []string) (map[string]int, error) {
	s.countCalls.Add(1)
	if s.err != nil {
		return nil, s.err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastEventIDs = append([]string(nil), eventIDs...)

	out := make(map[string]int, len(eventIDs))
	for _, id := range eventIDs {
		out[id] = s.counts[id]
	}
	return out, nil
}

func (s *stubSource) GetEvent(_ context.Context, id string) (*models.Event, error) {
	s.getCalls.Add(1)
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, e := range s.events {
		if e.ID == id {
			return e.Clone(), nil
		}
	}
	return nil, ErrNotFound
}

func (s *stubSource) CountRegistrations(_ context.Context, eventID string) (int, error) {
	s.singleCalls.Add(1)
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.counts[eventID], nil
}

func (s *stubSource) setCount(eventID string, n int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.counts[eventID] = n
}

func (s *stubSource) askedFor() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.lastEventIDs...)
}

// countingProvider wraps the memory provider so a test can assert the cache
// stopped at a tier rather than fell through to the next one.
type countingProvider struct {
	*cache.Memory
	gets, sets, deletes atomic.Int64

	mu      sync.Mutex
	getFail error
}

func newCountingProvider() *countingProvider {
	return &countingProvider{Memory: cache.NewMemory()}
}

func (p *countingProvider) failGetsWith(err error) {
	p.mu.Lock()
	p.getFail = err
	p.mu.Unlock()
}

func (p *countingProvider) Get(ctx context.Context, key string) ([]byte, error) {
	p.gets.Add(1)
	p.mu.Lock()
	err := p.getFail
	p.mu.Unlock()
	if err != nil {
		return nil, err
	}
	return p.Memory.Get(ctx, key)
}

func (p *countingProvider) Set(ctx context.Context, key string, val []byte, ttl time.Duration) error {
	p.sets.Add(1)
	return p.Memory.Set(ctx, key, val, ttl)
}

func (p *countingProvider) Delete(ctx context.Context, keys ...string) error {
	p.deletes.Add(1)
	return p.Memory.Delete(ctx, keys...)
}

func waitFor(t *testing.T, cond func() bool, msg string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal(msg)
}

func seedShared(t *testing.T, p cache.Provider, events []*models.Event, counts map[string]int) {
	t.Helper()
	ctx := context.Background()

	rawEvents, err := json.Marshal(events)
	if err != nil {
		t.Fatalf("encoding events: %v", err)
	}
	rawCounts, err := json.Marshal(counts)
	if err != nil {
		t.Fatalf("encoding counts: %v", err)
	}
	if err := p.Set(ctx, keyEvents, rawEvents, time.Minute); err != nil {
		t.Fatalf("seeding %s: %v", keyEvents, err)
	}
	if err := p.Set(ctx, keyCounts, rawCounts, time.Minute); err != nil {
		t.Fatalf("seeding %s: %v", keyCounts, err)
	}
}

func TestAColdCacheLoadsFromTheSourceAndFillsTheSharedTier(t *testing.T) {
	src := newStubSource(testEvent("e1", 10), testEvent("e2", 0))
	src.setCount("e1", 3)
	p := newCountingProvider()
	c := NewEventCache(src, p, p, time.Minute)

	got, err := c.All(context.Background())
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("got %d events, want 2", len(got))
	}
	if src.allCalls.Load() != 1 || src.countCalls.Load() != 1 {
		t.Fatalf("source calls: AllEvents=%d CountAllRegistrations=%d, want 1 and 1",
			src.allCalls.Load(), src.countCalls.Load())
	}

	// loadSource has to collect the event IDs now that CountAllRegistrations
	// takes them; an empty list would silently return zero counts for
	// everything.
	if ids := src.askedFor(); len(ids) != 2 {
		t.Fatalf("CountAllRegistrations was asked for %v, want both event IDs", ids)
	}

	// Both shared keys must be present for another instance to skip the scan.
	for _, k := range []string{keyEvents, keyCounts} {
		if _, err := p.Get(context.Background(), k); err != nil {
			t.Fatalf("%s was not written to the shared tier: %v", k, err)
		}
	}

	// The counts and the seat maths have to survive the trip.
	for _, e := range got {
		if e.EventID != "e1" {
			continue
		}
		if e.RegisteredCount != 3 {
			t.Fatalf("e1 RegisteredCount = %d, want 3", e.RegisteredCount)
		}
		if e.SeatsLeft == nil || *e.SeatsLeft != 7 {
			t.Fatalf("e1 SeatsLeft = %v, want 7", e.SeatsLeft)
		}
	}
}

func TestAWarmLocalCacheTouchesNeitherTheSharedTierNorTheSource(t *testing.T) {
	src := newStubSource(testEvent("e1", 10))
	p := newCountingProvider()
	c := NewEventCache(src, p, p, time.Minute)
	ctx := context.Background()

	if _, err := c.All(ctx); err != nil {
		t.Fatalf("warming: %v", err)
	}
	getsAfterWarm := p.gets.Load()

	for i := 0; i < 5; i++ {
		if _, err := c.All(ctx); err != nil {
			t.Fatalf("All: %v", err)
		}
	}
	if p.gets.Load() != getsAfterWarm {
		t.Fatalf("the shared tier was read %d extra times while L1 was warm",
			p.gets.Load()-getsAfterWarm)
	}
	if src.allCalls.Load() != 1 {
		t.Fatalf("AllEvents called %d times, want 1", src.allCalls.Load())
	}
}

func TestASharedSnapshotServesWithoutTouchingTheSource(t *testing.T) {
	src := newStubSource(testEvent("e1", 10))
	p := newCountingProvider()
	seedShared(t, p, []*models.Event{testEvent("e1", 10)}, map[string]int{"e1": 4})

	c := NewEventCache(src, p, p, time.Minute)
	got, err := c.All(context.Background())
	if err != nil {
		t.Fatalf("All: %v", err)
	}

	if src.allCalls.Load() != 0 || src.countCalls.Load() != 0 {
		t.Fatalf("the source was hit despite a warm shared snapshot: AllEvents=%d Counts=%d",
			src.allCalls.Load(), src.countCalls.Load())
	}
	if len(got) != 1 || got[0].RegisteredCount != 4 {
		t.Fatalf("got %+v, want one event with RegisteredCount 4", got)
	}
	if got[0].SeatsLeft == nil || *got[0].SeatsLeft != 6 {
		t.Fatalf("SeatsLeft = %v, want 6", got[0].SeatsLeft)
	}
}

func TestInvalidateClearsBothTiersAndBroadcasts(t *testing.T) {
	src := newStubSource(testEvent("e1", 10))
	p := newCountingProvider()
	c := NewEventCache(src, p, p, time.Minute)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if _, err := c.All(ctx); err != nil {
		t.Fatalf("warming: %v", err)
	}
	msgs, err := p.Subscribe(ctx, chanInvalidate)
	if err != nil {
		t.Fatalf("Subscribe: %v", err)
	}

	c.Invalidate()

	if !c.stale() {
		t.Fatal("the local copy survived Invalidate")
	}
	for _, k := range []string{keyEvents, keyCounts} {
		if _, err := p.Get(ctx, k); !errors.Is(err, cache.ErrMiss) {
			t.Fatalf("%s survived Invalidate: %v", k, err)
		}
	}
	select {
	case got := <-msgs:
		if string(got) != c.id {
			t.Fatalf("broadcast carried %q, want this instance's id %q", got, c.id)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Invalidate never broadcast")
	}
}

func TestARemoteInvalidationClearsTheLocalCopy(t *testing.T) {
	src := newStubSource(testEvent("e1", 10))
	p := newCountingProvider()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	reader := NewEventCache(src, p, p, time.Minute)
	reader.StartInvalidationListener(ctx)
	if _, err := reader.All(ctx); err != nil {
		t.Fatalf("warming: %v", err)
	}
	if reader.stale() {
		t.Fatal("the reader did not warm")
	}

	// A second instance against the same shared tier.
	writer := NewEventCache(src, p, p, time.Minute)
	writer.Invalidate()

	waitFor(t, reader.stale, "the reader kept its copy after another instance invalidated")
}

func TestAnInstanceIgnoresItsOwnBroadcast(t *testing.T) {
	src := newStubSource(testEvent("e1", 10))
	p := newCountingProvider()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	c := NewEventCache(src, p, p, time.Minute)
	c.StartInvalidationListener(ctx)
	if _, err := c.All(ctx); err != nil {
		t.Fatalf("warming: %v", err)
	}

	// Deliver our own id straight onto the channel, the way Invalidate would,
	// without going through Invalidate itself, which clears L1 on purpose.
	if err := p.Publish(ctx, chanInvalidate, []byte(c.id)); err != nil {
		t.Fatalf("Publish: %v", err)
	}

	time.Sleep(100 * time.Millisecond)
	if c.stale() {
		t.Fatal("the instance dropped its copy in response to its own broadcast")
	}
}

func TestConcurrentColdReadsCollapseIntoOneLoad(t *testing.T) {
	src := newStubSource(testEvent("e1", 10))
	src.delay = 50 * time.Millisecond
	p := newCountingProvider()
	c := NewEventCache(src, p, p, time.Minute)

	var wg sync.WaitGroup
	errs := make(chan error, 50)
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := c.All(context.Background()); err != nil {
				errs <- err
			}
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatalf("All: %v", err)
	}

	if n := src.allCalls.Load(); n != 1 {
		t.Fatalf("50 concurrent cold reads produced %d source loads, want 1", n)
	}
}

// Redis is a hard requirement, so a broken shared tier has to surface as an
// error rather than quietly falling through and hammering Firestore on every
// request.
func TestASharedTierFailureSurfacesInsteadOfFallingThrough(t *testing.T) {
	src := newStubSource(testEvent("e1", 10))
	p := newCountingProvider()
	boom := errors.New("connection refused")
	p.failGetsWith(boom)

	c := NewEventCache(src, p, p, time.Minute)
	if _, err := c.All(context.Background()); !errors.Is(err, boom) {
		t.Fatalf("All returned %v, want the provider error", err)
	}
	if src.allCalls.Load() != 0 {
		t.Fatal("the cache fell through to the source despite a failing shared tier")
	}
}

// A snapshot that is present but undecodable is a different matter from a
// transport failure: it counts as a miss and gets overwritten.
func TestAnUnreadableSnapshotIsDiscardedAndRebuilt(t *testing.T) {
	src := newStubSource(testEvent("e1", 10))
	src.setCount("e1", 2)
	p := newCountingProvider()
	ctx := context.Background()

	if err := p.Set(ctx, keyEvents, []byte("{not json"), time.Minute); err != nil {
		t.Fatalf("seeding garbage: %v", err)
	}
	if err := p.Set(ctx, keyCounts, []byte("{}"), time.Minute); err != nil {
		t.Fatalf("seeding counts: %v", err)
	}

	c := NewEventCache(src, p, p, time.Minute)
	got, err := c.All(ctx)
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	if len(got) != 1 || got[0].RegisteredCount != 2 {
		t.Fatalf("got %+v, want the rebuilt snapshot", got)
	}
	if src.allCalls.Load() != 1 {
		t.Fatalf("AllEvents called %d times, want 1", src.allCalls.Load())
	}

	raw, err := p.Get(ctx, keyEvents)
	if err != nil {
		t.Fatalf("re-reading the snapshot: %v", err)
	}
	var rewritten []*models.Event
	if err := json.Unmarshal(raw, &rewritten); err != nil {
		t.Fatalf("the garbage snapshot was not replaced: %v", err)
	}
}

// An event created moments ago is not in the snapshot yet, so Get falls back to
// a direct read rather than reporting it missing.
func TestGetFallsBackToADirectReadForAnEventNotInTheSnapshot(t *testing.T) {
	src := newStubSource(testEvent("e1", 10))
	p := newCountingProvider()
	c := NewEventCache(src, p, p, time.Minute)
	ctx := context.Background()

	if _, err := c.All(ctx); err != nil {
		t.Fatalf("warming: %v", err)
	}

	// Appears in the source after the cache was populated.
	src.mu.Lock()
	src.events = append(src.events, testEvent("e2", 4))
	src.counts["e2"] = 1
	src.mu.Unlock()

	got, err := c.Get(ctx, "e2")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.EventID != "e2" || got.RegisteredCount != 1 {
		t.Fatalf("got %+v, want e2 with RegisteredCount 1", got)
	}
	if got.SeatsLeft == nil || *got.SeatsLeft != 3 {
		t.Fatalf("SeatsLeft = %v, want 3", got.SeatsLeft)
	}
	if src.getCalls.Load() != 1 {
		t.Fatalf("GetEvent called %d times, want 1", src.getCalls.Load())
	}

	// A cached event must still be served from L1, not through the fallback.
	if _, err := c.Get(ctx, "e1"); err != nil {
		t.Fatalf("Get(e1): %v", err)
	}
	if src.getCalls.Load() != 1 {
		t.Fatal("a cached event went through the direct-read fallback")
	}
}
