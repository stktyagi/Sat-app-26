package store

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"backend/internal/cache"
	"backend/internal/models"
)

func newTestListCache(t *testing.T) (*ListCache[*models.Venue], *cache.Memory, *atomic.Int64) {
	t.Helper()
	l2 := cache.NewMemory()
	t.Cleanup(func() { l2.Close() })

	var calls atomic.Int64
	load := func(context.Context) ([]*models.Venue, error) {
		calls.Add(1)
		return []*models.Venue{{VenueID: "activity-space-2", VenueName: "Activity Space 2", Lat: 30.35, Lng: 76.36}}, nil
	}
	return NewListCache(l2, KeyVenues, time.Minute, load), l2, &calls
}

func TestListCacheMissLoadsAndStores(t *testing.T) {
	c, l2, calls := newTestListCache(t)
	ctx := context.Background()

	got, err := c.All(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].VenueID != "activity-space-2" {
		t.Fatalf("unexpected venues: %+v", got)
	}
	if calls.Load() != 1 {
		t.Fatalf("loader calls = %d, want 1", calls.Load())
	}
	if _, err := l2.Get(ctx, KeyVenues); err != nil {
		t.Fatalf("snapshot not written: %v", err)
	}
}

func TestListCacheHitSkipsLoader(t *testing.T) {
	c, _, calls := newTestListCache(t)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		if _, err := c.All(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if calls.Load() != 1 {
		t.Fatalf("loader calls = %d, want 1", calls.Load())
	}
}

func TestListCacheInvalidateReloads(t *testing.T) {
	c, _, calls := newTestListCache(t)
	ctx := context.Background()

	if _, err := c.All(ctx); err != nil {
		t.Fatal(err)
	}
	c.Invalidate()
	if _, err := c.All(ctx); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 2 {
		t.Fatalf("loader calls = %d, want 2", calls.Load())
	}
}

func TestListCacheUnreadableSnapshotIsMiss(t *testing.T) {
	c, l2, calls := newTestListCache(t)
	ctx := context.Background()

	if err := l2.Set(ctx, KeyVenues, []byte("not json"), time.Minute); err != nil {
		t.Fatal(err)
	}
	if _, err := c.All(ctx); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 1 {
		t.Fatalf("loader calls = %d, want 1", calls.Load())
	}
}
