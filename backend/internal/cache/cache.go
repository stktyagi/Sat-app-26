package cache

import (
	"context"
	"errors"
	"time"
)

// ErrMiss is returned when a key is not found in the cache.
var ErrMiss = errors.New("cache: key not found")

// Provider defines the interface for interacting with the L2 cache.
type Provider interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
	Delete(ctx context.Context, keys ...string) error
}

// Bus defines the interface for the publish-subscribe messaging.
type Bus interface {
	Publish(ctx context.Context, channel string, payload []byte) error
	Subscribe(ctx context.Context, channel string) (<-chan []byte, error)
}
