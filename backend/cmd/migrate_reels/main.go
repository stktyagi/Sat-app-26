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
	"backend/internal/cloudinary"
	"backend/internal/config"
	"backend/internal/fb"
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

	cld := cloudinary.NewClient(cfg.CloudinaryCloudName, cfg.CloudinaryAPIKey, cfg.CloudinaryAPISecret)
	if !cld.IsConfigured() {
		log.Fatalf("Cloudinary is not configured in .env")
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

	fmt.Printf("Starting Cloudinary Reel Upload & Firebase Migration (Original Quality)...\n")
	fmt.Printf("Target Folder in Cloudinary: sat26/reels\n\n")

	for _, item := range targets {
		if filterStem != "" && item.Stem != filterStem {
			continue
		}

		// Check if already migrated
		docSnap, err := clients.FS.Collection("reels").Doc(item.DocID).Get(ctx)
		if err == nil {
			vURL, _ := docSnap.Data()["videoUrl"].(string)
			if strings.Contains(vURL, "cloudinary.com") && filterStem == "" {
				fmt.Printf("[-] [%s.mp4] Already migrated to Cloudinary (%s), skipping.\n", item.Stem, vURL)
				continue
			}
		}

		filename := item.Stem + ".mp4"
		filePath := filepath.Join(reelsDir, filename)

		fileInfo, err := os.Stat(filePath)
		if err != nil {
			log.Fatalf("missing video file %s: %v", filePath, err)
		}

		sizeMB := float64(fileInfo.Size()) / (1024 * 1024)
		fmt.Printf(">>> Uploading [%s] (%.2f MB)...\n", filename, sizeMB)
		fmt.Printf("    Target Firestore Document: %s\n", item.DocID)

		file, err := os.Open(filePath)
		if err != nil {
			log.Fatalf("opening file %s: %v", filePath, err)
		}

		startTime := time.Now()
		res, err := cld.UploadVideo(ctx, "sat26/reels", filename, file)
		file.Close()
		if err != nil {
			log.Fatalf("upload error for %s: %v", filename, err)
		}

		thumbURL := cloudinary.GenerateAutoThumbnailURL(res.SecureURL)
		durationSec := int(res.Duration)
		if durationSec == 0 {
			durationSec = 30
		}

		fmt.Printf("    Uploaded in %v!\n", time.Since(startTime).Round(time.Millisecond))
		fmt.Printf("    Cloudinary Video URL: %s\n", res.SecureURL)
		fmt.Printf("    Cloudinary Public ID:  %s\n", res.PublicID)
		fmt.Printf("    Auto Thumbnail URL:   %s\n", thumbURL)

		// Update Firestore
		now := time.Now().UTC()
		updates := []firestore.Update{
			{Path: "videoUrl", Value: res.SecureURL},
			{Path: "videoRef", Value: res.PublicID},
			{Path: "thumbnailUrl", Value: thumbURL},
			{Path: "duration", Value: durationSec},
			{Path: "updatedAt", Value: now},
		}

		_, err = clients.FS.Collection("reels").Doc(item.DocID).Update(ctx, updates)
		if err != nil {
			log.Fatalf("updating firestore doc %s: %v", item.DocID, err)
		}
		fmt.Printf("    Firestore doc updated successfully!\n\n")

		// If a specific stem was requested, we are done
		if filterStem != "" {
			break
		}
	}

	// Invalidate Redis cache if available
	if cfg.RedisURL != "" {
		provider, err := cache.NewRedis(ctx, cfg.RedisURL, cfg.RedisNamespace)
		if err == nil {
			defer provider.Close()
			_ = provider.Delete(ctx, store.KeyReels)
			fmt.Println("Redis reels cache invalidated.")
		}
	}

	fmt.Println("Done!")
}
