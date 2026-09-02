package models_test

import (
	"testing"
	"time"

	"backend/internal/models"
)

func TestValidCategoryAndEventType(t *testing.T) {
	for _, c := range models.EventCategories {
		if !models.ValidCategory(c) {
			t.Errorf("%q should be a valid category", c)
		}
	}
	// Categories are capitalised, and the check is exact.
	for _, c := range []string{"technical", "Sports", "", "TECHNICAL"} {
		if models.ValidCategory(c) {
			t.Errorf("%q should not be a valid category", c)
		}
	}

	for _, tp := range []string{models.EventTypeIndividual, models.EventTypeTeam, models.EventTypeExternalLnk} {
		if !models.ValidEventType(tp) {
			t.Errorf("%q should be a valid event type", tp)
		}
	}
	for _, tp := range []string{"solo", "External", ""} {
		if models.ValidEventType(tp) {
			t.Errorf("%q should not be a valid event type", tp)
		}
	}
}

// Host students and external participants are priced separately, and an event
// that is not marked paid never charges either of them.
func TestFeeFor(t *testing.T) {
	paid := &models.Event{PaymentRequired: true, RegistrationFee: models.Fee{Host: 0, Other: 200}}
	if got := paid.FeeFor(true); got != 0 {
		t.Errorf("host fee = %d, want 0", got)
	}
	if got := paid.FeeFor(false); got != 200 {
		t.Errorf("external fee = %d, want 200", got)
	}

	free := &models.Event{PaymentRequired: false, RegistrationFee: models.Fee{Host: 10, Other: 20}}
	if got := free.FeeFor(false); got != 0 {
		t.Errorf("a fee left on an unpaid event must not be charged, got %d", got)
	}
}

func TestUnlimitedCapacity(t *testing.T) {
	if !(&models.Event{MaxParticipants: 0}).Unlimited() {
		t.Error("zero should mean unlimited")
	}
	if (&models.Event{MaxParticipants: 1}).Unlimited() {
		t.Error("a positive cap is not unlimited")
	}
}

func TestIsRegistrationOpen(t *testing.T) {
	now := time.Date(2026, 1, 5, 12, 0, 0, 0, time.UTC)

	cases := []struct {
		name     string
		event    models.Event
		expected bool
	}{
		{"a draft is closed however far off the deadline is",
			models.Event{IsPublic: false, RegistrationDeadline: "2026-06-01T00:00:00.000Z"}, false},
		{"published with a future deadline is open",
			models.Event{IsPublic: true, RegistrationDeadline: "2026-06-01T00:00:00.000Z"}, true},
		{"published with a past deadline is closed",
			models.Event{IsPublic: true, RegistrationDeadline: "2026-01-01T00:00:00.000Z"}, false},
		{"no deadline means open",
			models.Event{IsPublic: true}, true},
		// A malformed deadline must not silently close registration for an
		// event people can see and expect to enter.
		{"an unparseable deadline leaves it open",
			models.Event{IsPublic: true, RegistrationDeadline: "next tuesday"}, true},
	}
	for _, tc := range cases {
		if got := tc.event.IsRegistrationOpen(now); got != tc.expected {
			t.Errorf("%s: got %v", tc.name, got)
		}
	}
}

// The search is a substring match, which is the whole reason GET /events
// filters an in-memory slice instead of querying Firestore.
func TestMatchesIsASubstringSearch(t *testing.T) {
	event := &models.Event{
		Title:            "50 Hour Film Making",
		ShortDescription: "A weekend sprint",
		Category:         "Cultural",
		VenueName:        "Main Auditorium",
	}

	for _, q := range []string{"", "aking", "FILM", "50 hour", "cultural", "auditorium", "sprint"} {
		if !event.Matches(q) {
			t.Errorf("query %q should have matched", q)
		}
	}
	if event.Matches("robotics") {
		t.Error("an unrelated query should not match")
	}
}

// A cached event is shared between concurrent requests, so per-request values
// have to be attached to a copy.
func TestCloneDoesNotShareComputedFields(t *testing.T) {
	shared := &models.Event{Title: "Shared", MaxParticipants: 10}
	copied := shared.Clone()

	fee := 200
	copied.EffectiveFee = &fee
	copied.RegisteredCount = 5

	if shared.EffectiveFee != nil || shared.RegisteredCount != 0 {
		t.Error("decorating a clone must not touch the cached instance")
	}
}

func TestEventNormaliseFillsSliceFields(t *testing.T) {
	e := &models.Event{}
	e.Normalise()

	if e.Links == nil || e.Coordinators == nil || e.ReelsID == nil || e.CustomFields == nil {
		t.Error("Normalise should leave every slice field serialisable as []")
	}
}
