package cache

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// pingTimeout bounds the boot-time reachability check. Without it the ping
// runs on the caller's context, which is context.Background() in cmd/api, so a
// host that accepts the connection but never answers would stall the boot for
// go-redis's dial timeout times its retry count -- defeating the entire point
// of pinging before returning.
const pingTimeout = 2 * time.Second

type Redis struct {
	client    *redis.Client
	namespace string
}

func NewRedis(ctx context.Context, url, namespace string) (*Redis, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("parsing redis url: %w", err)
	}

	client := redis.NewClient(opts)
	pingCtx, cancel := context.WithTimeout(ctx, pingTimeout)
	defer cancel()
	if err := client.Ping(pingCtx).Err(); err != nil {
		client.Close()
		return nil, fmt.Errorf("pinging redis at %s: %w", opts.Addr, err)
	}

	return &Redis{
		client:    client,
		namespace: namespace,
	}, nil
}

func (r *Redis) Close() error {
	return r.client.Close()
}

func (r *Redis) ns(key string) string {
	if r.namespace == "" {
		return key
	}
	return r.namespace + ":" + key
}

func (r *Redis) Get(ctx context.Context, key string) ([]byte, error) {
	val, err := r.client.Get(ctx, r.ns(key)).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, ErrMiss
		}
		return nil, err
	}
	return val, nil
}

func (r *Redis) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	return r.client.Set(ctx, r.ns(key), value, ttl).Err()
}

func (r *Redis) Delete(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	nsKeys := make([]string, len(keys))
	for i, k := range keys {
		nsKeys[i] = r.ns(k)
	}
	return r.client.Del(ctx, nsKeys...).Err()
}

func (r *Redis) Publish(ctx context.Context, channel string, payload []byte) error {
	return r.client.Publish(ctx, r.ns(channel), payload).Err()
}

func (r *Redis) Subscribe(ctx context.Context, channel string) (<-chan []byte, error) {
	pubsub := r.client.Subscribe(ctx, r.ns(channel))

	// Wait for subscription confirmation
	_, err := pubsub.Receive(ctx)
	if err != nil {
		pubsub.Close()
		return nil, err
	}

	ch := pubsub.Channel()
	out := make(chan []byte)

	go func() {
		defer close(out)
		defer pubsub.Close()
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				out <- []byte(msg.Payload)
			}
		}
	}()

	return out, nil
}
