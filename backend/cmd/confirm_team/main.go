package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"backend/internal/config"
	"backend/internal/fb"
	"backend/internal/isotime"
	"backend/internal/models"

	"cloud.google.com/go/firestore"
)

// ============================================================================
// CONFIGURATION
// ============================================================================
// 1. Event ID for SatHack
const defaultEventID = "aW1tDpT2nXulKu3leCfe"

// 2. Put the Team Invite Code here (e.g. "0AA8F8"), OR pass it via CLI argument
var teamCode = ""

// ============================================================================

func main() {
	cliCode := flag.String("code", "", "Team invite code (optional if set in file)")
	cliEvent := flag.String("event", defaultEventID, "Event ID")
	flag.Parse()

	// Resolve team code from: 1) CLI flag, 2) positional CLI arg, 3) hardcoded variable
	code := strings.TrimSpace(*cliCode)
	if code == "" && flag.NArg() > 0 {
		code = strings.TrimSpace(flag.Arg(0))
	}
	if code == "" {
		code = strings.TrimSpace(teamCode)
	}

	if code == "" {
		fmt.Println("================================================================================")
		fmt.Println("ERROR: No team code provided!")
		fmt.Println("Please either:")
		fmt.Println("  1. Edit backend/cmd/confirm_team/main.go and set `var teamCode = \"YOUR_CODE\"`")
		fmt.Println("  2. Or run: go run ./cmd/confirm_team <TEAM_CODE>")
		fmt.Println("================================================================================")
		os.Exit(1)
	}

	eventID := strings.TrimSpace(*cliEvent)

	// Clean code: uppercase, trim prefix if full doc ID was passed
	code = strings.ToUpper(code)
	prefix := fmt.Sprintf("%s_", eventID)
	code = strings.TrimPrefix(code, prefix)

	docID := fmt.Sprintf("%s_%s", eventID, code)

	ctx := context.Background()
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load failed: %v", err)
	}
	clients, err := fb.New(ctx, cfg)
	if err != nil {
		log.Fatalf("firebase init failed: %v", err)
	}

	fmt.Printf("\nLooking up team with Document ID: %s (Invite Code: %s) in event %s...\n", docID, code, eventID)
	teamRef := clients.FS.Collection("teamRegistrations").Doc(docID)
	snap, err := teamRef.Get(ctx)
	if err != nil {
		log.Fatalf("Failed to fetch team %q: %v\nMake sure the team invite code is correct.", docID, err)
	}

	data := snap.Data()
	teamName := strings.TrimSpace(fmt.Sprint(data["teamName"]))
	oldStatus := strings.TrimSpace(fmt.Sprint(data["status"]))
	leaderUserID := strings.TrimSpace(fmt.Sprint(data["leaderUserId"]))

	var memberIDs []string
	if rawMembers, ok := data["memberIds"].([]interface{}); ok {
		for _, m := range rawMembers {
			if s, ok := m.(string); ok && s != "" {
				memberIDs = append(memberIDs, s)
			}
		}
	}

	fmt.Println("\n--- Team Found ---")
	fmt.Printf("Team Name:       %s\n", teamName)
	fmt.Printf("Invite Code:     %s\n", code)
	fmt.Printf("Document ID:     %s\n", docID)
	fmt.Printf("Current Status:  %s\n", oldStatus)
	fmt.Printf("Leader User ID:  %s\n", leaderUserID)
	fmt.Printf("Members (%d):     %s\n", len(memberIDs), strings.Join(memberIDs, ", "))

	now := isotime.Now()

	// 1. Update Team Status to confirmed
	batch := clients.FS.Batch()
	batch.Update(teamRef, []firestore.Update{
		{Path: "status", Value: models.TeamStatusConfirmed},
		{Path: "updatedAt", Value: now},
	})

	// 2. Also update all team members' user registrations to confirmed
	for _, mID := range memberIDs {
		regID := models.RegistrationID(eventID, mID)
		regRef := clients.FS.Collection("userEventRegistrations").Doc(regID)
		batch.Update(regRef, []firestore.Update{
			{Path: "status", Value: models.RegStatusConfirmed},
		})
	}

	fmt.Printf("\nApplying confirmation to team %q and its %d member registrations in Firestore...\n", teamName, len(memberIDs))
	if _, err := batch.Commit(ctx); err != nil {
		log.Fatalf("Failed to commit updates to Firestore: %v", err)
	}

	fmt.Println("\n================================================================================")
	fmt.Printf("SUCCESS! Team %q (%s) is now CONFIRMED!\n", teamName, code)
	fmt.Printf(" - Team status changed: %s -> confirmed\n", oldStatus)
	fmt.Printf(" - %d member registrations updated to confirmed\n", len(memberIDs))
	fmt.Println("================================================================================")
}
