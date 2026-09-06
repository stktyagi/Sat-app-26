package main

import (
	"context"
	"fmt"
	"log"

	"backend/internal/config"
	"backend/internal/fb"
)

func main() {
	ctx := context.Background()
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	clients, err := fb.New(ctx, cfg)
	if err != nil {
		log.Fatalf("fb: %v", err)
	}

	iter := clients.FS.Collection("users").Documents(ctx)
	defer iter.Stop()

	problems := 0
	for {
		doc, err := iter.Next()
		if err != nil {
			break
		}
		data := doc.Data()
		// Check all int fields
		intFields := []string{"coins"}
		for _, f := range intFields {
			if val, ok := data[f]; ok {
				if _, isStr := val.(string); isStr {
					fmt.Printf("User %s field '%s' is a STRING: '%v'\n", doc.Ref.ID, f, val)
					problems++
				}
			}
		}
		// Check bool fields
		boolFields := []string{"fullyRegistered", "isVerified", "isAmbassador", "accommodationNeeded"}
		for _, f := range boolFields {
			if val, ok := data[f]; ok {
				switch val.(type) {
				case bool:
					// ok
				default:
					fmt.Printf("User %s field '%s' has unexpected type %T: %v\n", doc.Ref.ID, f, val, val)
					problems++
				}
			}
		}
		// Check slice fields
		sliceFields := []string{"roles", "interests"}
		for _, f := range sliceFields {
			if val, ok := data[f]; ok {
				switch val.(type) {
				case []interface{}, nil:
					// ok
				default:
					fmt.Printf("User %s field '%s' has unexpected type %T: %v\n", doc.Ref.ID, f, val, val)
					problems++
				}
			}
		}
	}
	if problems == 0 {
		fmt.Println("All user documents look clean!")
	} else {
		fmt.Printf("\nFound %d problem(s) in user documents.\n", problems)
	}
}
