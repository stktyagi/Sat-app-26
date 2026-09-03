package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/internal/cache"
	"backend/internal/config"
	"backend/internal/fb"
	"backend/internal/handlers"
	"backend/internal/qr"
	"backend/internal/store"
	"backend/internal/chatbot"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	clients, err := fb.New(ctx, cfg)
	if err != nil {
		log.Fatalf("firebase: %v", err)
	}
	defer clients.Close()

	// NewRedis pings before returning, so an unreachable Redis stops the boot
	// here rather than turning every later request into a 500.
	provider, err := cache.NewRedis(ctx, cfg.RedisURL, cfg.RedisNamespace)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer provider.Close()

	st := store.New(clients.FS, cfg)
	events := store.NewEventCache(st, provider, provider, cfg.EventCacheTTL)
	events.StartInvalidationListener(ctx)
	cb := chatbot.NewService(cfg.GroqAPIKey)
	api := handlers.New(st, events, qr.New(cfg.QRSecret), cfg, cb, clients)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handlers.Router(cfg, clients, st, events, api),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		if cfg.UseEmulator {
			log.Printf("using the Firebase emulators")
		}
		log.Printf("listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Printf("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
