package store

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"time"

	"golang.org/x/sync/singleflight"

	"backend/internal/cache"
)

// Shared cache keys for the small lookup collections.
const (
	KeyFaqs   = "faqs:all"
	KeyVenues = "venues:all"
)

// ListCache holds a whole small collection in L2 only.
//
// Unlike EventCache there is no per-process copy: nothing here needs in-memory
// filtering, and one Redis GET per request is cheap. Without an L1 there is
// nothing to broadcast either — deleting the shared key is enough for every
// instance to see an admin's change on its next read.
type ListCache[T any] struct {
	l2   cache.Provider
	key  string
	ttl  time.Duration
	load func(ctx context.Context) ([]T, error)

	// sf collapses concurrent reloads on a miss within this instance.
	sf singleflight.Group
}

func NewListCache[T any](l2 cache.Provider, key string, ttl time.Duration, load func(ctx context.Context) ([]T, error)) *ListCache[T] {
	return &ListCache[T]{l2: l2, key: key, ttl: ttl, load: load}
}

// All follows the EventCache.loadShared policy: a transport error surfaces,
// while an unreadable blob counts as a miss and gets overwritten.
func (c *ListCache[T]) All(ctx context.Context) ([]T, error) {
	raw, err := c.l2.Get(ctx, c.key)
	switch {
	case err == nil:
		var out []T
		if err := json.Unmarshal(raw, &out); err == nil && out != nil {
			return out, nil
		}
		log.Printf("cache: discarding an unreadable %s snapshot", c.key)
	case !errors.Is(err, cache.ErrMiss):
		return nil, err
	}

	v, err, _ := c.sf.Do(c.key, func() (any, error) {
		items, err := c.load(ctx)
		if err != nil {
			return nil, err
		}
		if items == nil {
			items = []T{}
		}
		if raw, err := json.Marshal(items); err != nil {
			log.Printf("cache: encoding %s: %v", c.key, err)
		} else if err := c.l2.Set(ctx, c.key, raw, c.ttl); err != nil {
			log.Printf("cache: writing %s: %v", c.key, err)
		}
		return items, nil
	})
	if err != nil {
		return nil, err
	}
	return v.([]T), nil
}

// Invalidate deletes the shared snapshot. Like EventCache.Invalidate it runs
// after a committed write, so it logs rather than failing the request.
func (c *ListCache[T]) Invalidate() {
	ctx, cancel := context.WithTimeout(context.Background(), invalidateTimeout)
	defer cancel()
	if err := c.l2.Delete(ctx, c.key); err != nil {
		log.Printf("cache: deleting %s: %v", c.key, err)
	}
}
