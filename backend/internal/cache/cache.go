// Package cache is the boundary between this API and a process-external cache.
//
// Everything here is byte-oriented on purpose: a provider must not know about
// domain types, so each consumer owns its own serialisation and a second one
// can pick a different encoding without touching this package.
package cache

import (
	"context"
	"errors"
	"time"
)

// ErrMiss is returned when a key is not found in the cache. It follows the
// sentinel convention store.wrap() already established, so a miss is not
// something a caller has to string-match for.
var ErrMiss = errors.New("cache: key not found")

// Provider defines the interface for interacting with the L2 cache.
type Provider interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
	Delete(ctx context.Context, keys ...string) error
	// Close releases whatever connection the provider owns. It is on the
	// interface so an implementation cannot quietly forget one.
	Close() error
}

// Bus is the fan-out half, kept separate so a consumer that only reads and
// writes does not have to care that broadcasting exists.
type Bus interface {
	Publish(ctx context.Context, channel string, payload []byte) error
	Subscribe(ctx context.Context, channel string) (<-chan []byte, error)
}
