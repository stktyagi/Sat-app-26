package main

import (
	"context"
	"flag"
	"fmt"
	"log"

	"backend/internal/cache"
	"backend/internal/config"
)

func main() {
	all := flag.Bool("all", false, "Invalidate all cached entities (events, venues, stories, banners, etc.)")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	r, err := cache.NewRedis(ctx, cfg.RedisURL, cfg.RedisNamespace)
	if err != nil {
		log.Fatalf("connecting to redis at %s: %v", cfg.RedisURL, err)
	}
	defer r.Close()

	if *all {
		keys := []string{
			"events:all", "events:counts",
			"venues:all", "stories:all", "banners:all",
			"faqs:all", "store:all", "reels:all",
		}
		if err := r.Delete(ctx, keys...); err != nil {
			log.Printf("Failed to delete keys: %v", err)
		} else {
			fmt.Printf("Deleted cache keys (%v) for namespace %q\n", keys, cfg.RedisNamespace)
		}
	} else {
		if err := r.Delete(ctx, "events:all", "events:counts"); err != nil {
			log.Fatalf("deleting events cache: %v", err)
		}
		fmt.Printf("Deleted 'events:all' and 'events:counts' for namespace %q\n", cfg.RedisNamespace)
	}

	// Publish invalidation so all live instances drop their in-memory L1 cache
	if err := r.Publish(ctx, "events:invalidate", []byte("manual_invalidation")); err != nil {
		log.Printf("Warning: publish invalidation failed: %v", err)
	} else {
		fmt.Printf("Published invalidation message to %q:events:invalidate\n", cfg.RedisNamespace)
	}

	fmt.Println("Success! Live backend instances will reload fresh events from Firestore on next request.")
}
