package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"backend/internal/config"
	"backend/internal/cache"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	ctx := context.Background()
	for i := 0; i < 5; i++ {
		start := time.Now()
		r, err := cache.NewRedis(ctx, cfg.RedisURL, cfg.RedisNamespace)
		elapsed := time.Since(start)
		if err != nil {
			fmt.Printf("Attempt %d: FAILED in %v: %v\n", i+1, elapsed, err)
		} else {
			fmt.Printf("Attempt %d: OK in %v\n", i+1, elapsed)
			r.Close()
		}
		time.Sleep(500 * time.Millisecond)
	}
}
