package store

import (
	"context"
	"slices"
	"testing"
)

func TestAllColleges(t *testing.T) {
	st := &Store{}
	ctx := context.Background()

	colleges, err := st.AllColleges(ctx)
	if err != nil {
		t.Fatalf("AllColleges failed: %v", err)
	}

	if len(colleges) == 0 {
		t.Fatalf("expected colleges list to not be empty")
	}

	// Verify first item and that list has > 1000 colleges
	if len(colleges) < 1000 {
		t.Errorf("expected > 1000 colleges, got %d", len(colleges))
	}

	// Verify Bennett University is present
	if !slices.Contains(colleges, "Bennett University") {
		t.Errorf("expected 'Bennett University' in colleges list")
	}
	if !slices.Contains(colleges, "Bennet University") {
		t.Errorf("expected 'Bennet University' in colleges list")
	}
}

func TestSearchColleges(t *testing.T) {
	st := &Store{}
	ctx := context.Background()

	// Empty query returns all
	all, err := st.SearchColleges(ctx, "")
	if err != nil {
		t.Fatalf("SearchColleges with empty query failed: %v", err)
	}
	if len(all) == 0 {
		t.Fatalf("expected colleges")
	}

	// Search for "Patel"
	matches, err := st.SearchColleges(ctx, "patel")
	if err != nil {
		t.Fatalf("SearchColleges for 'patel' failed: %v", err)
	}
	if len(matches) == 0 {
		t.Fatalf("expected matches for 'patel'")
	}

	// Search for "bennet"
	bennetMatches, err := st.SearchColleges(ctx, "bennet")
	if err != nil {
		t.Fatalf("SearchColleges for 'bennet' failed: %v", err)
	}
	if len(bennetMatches) == 0 {
		t.Fatalf("expected matches for 'bennet'")
	}

	// Search for non-existent college
	nonExistent, err := st.SearchColleges(ctx, "xyznonexistentcollege12345")
	if err != nil {
		t.Fatalf("SearchColleges failed: %v", err)
	}
	if len(nonExistent) != 0 {
		t.Errorf("expected 0 matches, got %d", len(nonExistent))
	}
}
