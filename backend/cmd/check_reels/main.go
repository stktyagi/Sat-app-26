package main

import (
	"context"
	"fmt"
	"log"

	"backend/internal/config"
	"backend/internal/fb"
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

	docs, err := clients.FS.Collection("reels").Documents(ctx).GetAll()
	if err != nil {
		log.Fatalf("get reels: %v", err)
	}

	fmt.Printf("Total reels in Firestore: %d\n\n", len(docs))
	for _, doc := range docs {
		data := doc.Data()
		fmt.Printf("Doc ID:       %s\n", doc.Ref.ID)
		fmt.Printf("Title:        %v\n", data["title"])
		fmt.Printf("Video URL:    %v\n", data["videoUrl"])
		fmt.Printf("Thumbnail:    %v\n", data["thumbnailUrl"])
		fmt.Printf("Public ID:    %v\n\n", data["videoRef"])
	}
}
