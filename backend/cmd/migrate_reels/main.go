package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cloud.google.com/go/firestore"

	"backend/internal/cache"
	"backend/internal/config"
	"backend/internal/fb"
	"backend/internal/s3storage"
	"backend/internal/store"
)

// Ordered list of stems and their Firestore document IDs.
type reelTarget struct {
	Stem  string
	DocID string
}

var targets = []reelTarget{
	{Stem: "a_glimpse_of_madness", DocID: "rGjIWkxRJJt1ihWDBoye"},        // 11.3 MB
	{Stem: "the_walk", DocID: "rGU6iCHSJKLm1RRTfd16"},                    // 21.1 MB
	{Stem: "something_big_is_on_its_way", DocID: "8KpYFNIWHieWn0YmxnyA"}, // 14.8 MB
	{Stem: "saturnalia_is_back", DocID: "CUPe3uFK0ohNOwbz8wlP"},          // 56.7 MB
	{Stem: "dance_at_sat", DocID: "r29pLP43ZqtRhiTZFEuO"},                // 64.4 MB
	{Stem: "music_at_sat", DocID: "oahiw2FNfFFFSa4UV5G7"},                // 80.1 MB
	{Stem: "the_game_is_about_to_change", DocID: "D3In9tom4pBHqiC0hDAu"}, // 86.6 MB
}

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

	s3c := s3storage.NewClient(cfg.AWSRegion, cfg.AWSS3Bucket, cfg.AWSAccessKeyID, cfg.AWSSecretAccessKey)
	if !s3c.IsConfigured() {
		log.Fatalf("AWS S3 is not configured in .env (bucket=%s, region=%s)", cfg.AWSS3Bucket, cfg.AWSRegion)
	}

	reelsDir := "reels"
	if _, err := os.Stat(reelsDir); err != nil {
		reelsDir = "backend/reels"
		if _, err := os.Stat(reelsDir); err != nil {
			log.Fatalf("could not find reels directory")
		}
	}

	filterStem := ""
	if len(os.Args) > 1 {
		filterStem = strings.TrimSpace(os.Args[1])
	}

	fmt.Printf("Starting AWS S3 Reel Upload & Firebase Migration (Original Full Quality)...\n")
	fmt.Printf("AWS S3 Bucket: %s (%s)\n\n", s3c.Bucket, s3c.Region)

	for _, item := range targets {
		if filterStem != "" && item.Stem != filterStem {
			continue
		}

		filename := item.Stem + ".mp4"
		filePath := filepath.Join(reelsDir, filename)

		fileInfo, err := os.Stat(filePath)
		if err != nil {
			log.Fatalf("missing video file %s: %v", filePath, err)
		}

		sizeMB := float64(fileInfo.Size()) / (1024 * 1024)
		fmt.Printf(">>> Processing [%s] (%.2f MB)...\n", filename, sizeMB)
		fmt.Printf("    Target Firestore Doc ID: %s\n", item.DocID)

		// 1. Upload original video to S3
		startTime := time.Now()
		vRes, err := s3c.UploadFile(ctx, "reels", filePath)
		if err != nil {
			log.Fatalf("failed to upload %s to S3: %v", filename, err)
		}
		uploadDuration := time.Since(startTime).Round(time.Millisecond)
		fmt.Printf("    Video uploaded in %v!\n", uploadDuration)
		fmt.Printf("    Video S3 Key: %s\n", vRes.Key)
		fmt.Printf("    Video URL:    %s\n", vRes.URL)

		// 2. Extract high quality thumbnail from frame 0 and upload to S3
		tRes, err := s3c.ExtractThumbnailFromVideo(ctx, filePath, "reels/thumbnails", item.Stem)
		if err != nil {
			log.Fatalf("failed to extract/upload thumbnail for %s: %v", filename, err)
		}
		fmt.Printf("    Thumb S3 Key: %s\n", tRes.Key)
		fmt.Printf("    Thumb URL:    %s\n", tRes.URL)

		// 3. Extract exact video duration using ffprobe
		durationSec, err := s3c.GetVideoDuration(ctx, filePath)
		if err != nil {
			fmt.Printf("    Warning: ffprobe failed (%v), defaulting duration to 30s\n", err)
			durationSec = 30
		}
		fmt.Printf("    Duration:     %ds\n", durationSec)

		// 4. Update Firestore
		now := time.Now().UTC()
		updates := []firestore.Update{
			{Path: "videoUrl", Value: vRes.URL},
			{Path: "videoRef", Value: vRes.Key},
			{Path: "thumbnailUrl", Value: tRes.URL},
			{Path: "thumbnailRef", Value: tRes.Key},
			{Path: "duration", Value: durationSec},
			{Path: "updatedAt", Value: now},
		}

		_, err = clients.FS.Collection("reels").Doc(item.DocID).Update(ctx, updates)
		if err != nil {
			log.Fatalf("updating firestore doc %s: %v", item.DocID, err)
		}
		fmt.Printf("    Firestore document successfully updated!\n\n")

		if filterStem != "" {
			break
		}
	}

	// 5. Invalidate Redis cache if available
	if cfg.RedisURL != "" {
		provider, err := cache.NewRedis(ctx, cfg.RedisURL, cfg.RedisNamespace)
		if err == nil {
			defer provider.Close()
			_ = provider.Delete(ctx, store.KeyReels)
			fmt.Println("Redis reels cache invalidated.")
		}
	}
	fmt.Println("All festival reels migrated to AWS S3 successfully!")
}
