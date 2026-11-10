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
	"backend/internal/chatbot"
	"backend/internal/cloudinary"
	"backend/internal/config"
	"backend/internal/fb"
	"backend/internal/handlers"
	"backend/internal/qr"
	"backend/internal/storage"
	"backend/internal/store"
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

	var mediaStore *storage.Store
	if cfg.ImageKitAccountsFile != "" {
		// Fatal on purpose: a broken accounts file should stop the deploy, not
		// surface later as every upload failing with storage_not_configured.
		ms, err := storage.New(cfg.ImageKitAccountsFile, provider)
		if err != nil {
			log.Fatalf("imagekit storage: %v", err)
		}
		mediaStore = ms
	}

	cld := cloudinary.NewClient(cfg.CloudinaryCloudName, cfg.CloudinaryAPIKey, cfg.CloudinaryAPISecret)

	st := store.New(clients.FS, cfg)
	events := store.NewEventCache(st, provider, provider, cfg.EventCacheTTL)
	events.StartInvalidationListener(ctx)
	cb := chatbot.NewService(cfg.GroqAPIKey)
	faqs := store.NewListCache(provider, store.KeyFaqs, cfg.EventCacheTTL, st.AllFaqs)
	venues := store.NewListCache(provider, store.KeyVenues, cfg.EventCacheTTL, st.AllVenues)
	banners := store.NewListCache(provider, store.KeyBanners, cfg.EventCacheTTL, st.AllBanners)
	reels := store.NewListCache(provider, store.KeyReels, cfg.EventCacheTTL, st.AllReels)
	stories := store.NewListCache(provider, store.KeyStories, cfg.EventCacheTTL, st.AllStories)
	storeItems := store.NewListCache(provider, store.KeyStore, cfg.EventCacheTTL, st.AllStoreItems)
	api := handlers.New(st, events, faqs, venues, banners, reels, stories, storeItems, qr.New(cfg.QRSecret), cfg, cb, clients, mediaStore, cld)

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

	// Warm the caches in the background so the first real request does not pay
	// the Firestore round-trip cost. This runs after the server is already
	// listening, so it never delays startup.
	go func() {
		wctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if _, err := events.All(wctx); err != nil {
			log.Printf("cache warm: events: %v", err)
		} else {
			log.Printf("cache warm: events ready")
		}
		if _, err := faqs.All(wctx); err != nil {
			log.Printf("cache warm: faqs: %v", err)
		} else {
			log.Printf("cache warm: faqs ready")
		}
		if _, err := venues.All(wctx); err != nil {
			log.Printf("cache warm: venues: %v", err)
		} else {
			log.Printf("cache warm: venues ready")
		}
		if _, err := banners.All(wctx); err != nil {
			log.Printf("cache warm: banners: %v", err)
		} else {
			log.Printf("cache warm: banners ready")
		}
		if _, err := reels.All(wctx); err != nil {
			log.Printf("cache warm: reels: %v", err)
		} else {
			log.Printf("cache warm: reels ready")
		}
		if _, err := stories.All(wctx); err != nil {
			log.Printf("cache warm: stories: %v", err)
		} else {
			log.Printf("cache warm: stories ready")
		}
		if _, err := storeItems.All(wctx); err != nil {
			log.Printf("cache warm: store items: %v", err)
		} else {
			log.Printf("cache warm: store items ready")
		}
		if err := st.EnsureAppDefaults(wctx); err != nil {
			log.Printf("app config defaults init error: %v", err)
		} else {
			log.Printf("app config defaults initialized")
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
