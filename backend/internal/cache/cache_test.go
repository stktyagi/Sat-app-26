package cache_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"

	"backend/internal/cache"
)

// backend pairs a provider with the way its clock is moved forward, so one
// contract can be run against both implementations. Redis TTLs are real
// elapsed time under miniredis's control; the memory provider uses the wall
// clock, so it genuinely sleeps.
type backend struct {
	name    string
	newFn   func(t *testing.T, namespace string) provider
	advance func(t *testing.T, d time.Duration)
}

// provider is both halves at once, which both implementations satisfy.
type provider interface {
	cache.Provider
	cache.Bus
}

func backends() []backend {
	// One miniredis server per subtest, kept in a closure so the advance
	// function can reach the same server the provider is talking to.
	var current *miniredis.Miniredis

	return []backend{
		{
			name: "memory",
			newFn: func(t *testing.T, _ string) provider {
				m := cache.NewMemory()
				t.Cleanup(func() { m.Close() })
				return m
			},
			advance: func(_ *testing.T, d time.Duration) { time.Sleep(d) },
		},
		{
			name: "redis",
			newFn: func(t *testing.T, namespace string) provider {
				if current == nil {
					current = miniredis.RunT(t)
				}
				r, err := cache.NewRedis(context.Background(), "redis://"+current.Addr(), namespace)
				if err != nil {
					t.Fatalf("connecting to miniredis: %v", err)
				}
				t.Cleanup(func() { r.Close() })
				return r
			},
			advance: func(t *testing.T, d time.Duration) {
				if current == nil {
					t.Fatal("advance called before a provider was built")
				}
				current.FastForward(d)
			},
		},
	}
}

// eachBackend resets the shared miniredis between subtests by rebuilding the
// backend list, so one subtest's keys cannot leak into the next.
func eachBackend(t *testing.T, run func(t *testing.T, b backend)) {
	t.Helper()
	for _, b := range backends() {
		t.Run(b.name, func(t *testing.T) { run(t, b) })
	}
}

func TestGetReportsAMissForAnAbsentKey(t *testing.T) {
	eachBackend(t, func(t *testing.T, b backend) {
		p := b.newFn(t, "test")

		_, err := p.Get(context.Background(), "nothing:here")
		if !errors.Is(err, cache.ErrMiss) {
			t.Fatalf("wanted ErrMiss for an absent key, got %v", err)
		}
	})
}

func TestSetAndGetRoundTrip(t *testing.T) {
	eachBackend(t, func(t *testing.T, b backend) {
		p := b.newFn(t, "test")
		ctx := context.Background()
		want := []byte(`{"events":[]}`)

		if err := p.Set(ctx, "roundtrip", want, time.Minute); err != nil {
			t.Fatalf("Set: %v", err)
		}
		got, err := p.Get(ctx, "roundtrip")
		if err != nil {
			t.Fatalf("Get: %v", err)
		}
		if string(got) != string(want) {
			t.Fatalf("got %q, want %q", got, want)
		}
	})
}

func TestAnEntryExpiresAfterItsTTL(t *testing.T) {
	eachBackend(t, func(t *testing.T, b backend) {
		p := b.newFn(t, "test")
		ctx := context.Background()

		if err := p.Set(ctx, "shortlived", []byte("x"), 50*time.Millisecond); err != nil {
			t.Fatalf("Set: %v", err)
		}
		b.advance(t, 80*time.Millisecond)

		if _, err := p.Get(ctx, "shortlived"); !errors.Is(err, cache.ErrMiss) {
			t.Fatalf("wanted ErrMiss once the TTL elapsed, got %v", err)
		}
	})
}

func TestDeleteRemovesEveryKeyItIsGiven(t *testing.T) {
	eachBackend(t, func(t *testing.T, b backend) {
		p := b.newFn(t, "test")
		ctx := context.Background()

		for _, k := range []string{"a", "b"} {
			if err := p.Set(ctx, k, []byte(k), time.Minute); err != nil {
				t.Fatalf("Set %s: %v", k, err)
			}
		}
		if err := p.Delete(ctx, "a", "b"); err != nil {
			t.Fatalf("Delete: %v", err)
		}
		for _, k := range []string{"a", "b"} {
			if _, err := p.Get(ctx, k); !errors.Is(err, cache.ErrMiss) {
				t.Fatalf("%s survived the delete: %v", k, err)
			}
		}
	})
}

// An empty Delete has to be a no-op rather than an error: Redis rejects DEL
// with no arguments, and a caller building a key list can legitimately end up
// with none.
func TestDeleteWithNoKeysSucceeds(t *testing.T) {
	eachBackend(t, func(t *testing.T, b backend) {
		if err := b.newFn(t, "test").Delete(context.Background()); err != nil {
			t.Fatalf("Delete with no keys: %v", err)
		}
	})
}

func TestPublishReachesASubscriber(t *testing.T) {
	eachBackend(t, func(t *testing.T, b backend) {
		p := b.newFn(t, "test")
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		msgs, err := p.Subscribe(ctx, "events:invalidate")
		if err != nil {
			t.Fatalf("Subscribe: %v", err)
		}
		if err := p.Publish(ctx, "events:invalidate", []byte("instance-1")); err != nil {
			t.Fatalf("Publish: %v", err)
		}

		select {
		case got := <-msgs:
			if string(got) != "instance-1" {
				t.Fatalf("got payload %q, want %q", got, "instance-1")
			}
		case <-time.After(2 * time.Second):
			t.Fatal("the broadcast never arrived")
		}
	})
}

// The namespace is what lets one Redis serve several environments, so it has to
// actually reach the wire.
func TestTheNamespacePrefixesStoredKeys(t *testing.T) {
	s := miniredis.RunT(t)
	p, err := cache.NewRedis(context.Background(), "redis://"+s.Addr(), "sat26")
	if err != nil {
		t.Fatalf("connecting to miniredis: %v", err)
	}
	defer p.Close()

	if err := p.Set(context.Background(), "events:all", []byte("[]"), time.Minute); err != nil {
		t.Fatalf("Set: %v", err)
	}
	if got, err := s.Get("sat26:events:all"); err != nil || got != "[]" {
		t.Fatalf("wanted the key stored as sat26:events:all, got %q (%v)", got, err)
	}
	if _, err := s.Get("events:all"); err == nil {
		t.Fatal("the key was also written unprefixed")
	}
}

func TestTwoNamespacesDoNotSeeEachOther(t *testing.T) {
	s := miniredis.RunT(t)
	ctx := context.Background()

	dev, err := cache.NewRedis(ctx, "redis://"+s.Addr(), "dev")
	if err != nil {
		t.Fatalf("dev: %v", err)
	}
	defer dev.Close()
	prod, err := cache.NewRedis(ctx, "redis://"+s.Addr(), "prod")
	if err != nil {
		t.Fatalf("prod: %v", err)
	}
	defer prod.Close()

	if err := dev.Set(ctx, "events:all", []byte("dev snapshot"), time.Minute); err != nil {
		t.Fatalf("Set: %v", err)
	}
	if _, err := prod.Get(ctx, "events:all"); !errors.Is(err, cache.ErrMiss) {
		t.Fatalf("prod read dev's snapshot: %v", err)
	}
}

// The ping is what turns an unreachable Redis into a refused boot instead of a
// 500 on every later request, so it is worth pinning down.
func TestNewRedisRefusesAnUnreachableServer(t *testing.T) {
	s := miniredis.RunT(t)
	addr := s.Addr()
	s.Close()

	if _, err := cache.NewRedis(context.Background(), "redis://"+addr, "test"); err == nil {
		t.Fatal("NewRedis accepted a server that is not listening")
	}
}

func TestNewRedisRefusesAMalformedURL(t *testing.T) {
	if _, err := cache.NewRedis(context.Background(), "not-a-url", "test"); err == nil {
		t.Fatal("NewRedis accepted a malformed URL")
	}
}
