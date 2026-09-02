package handlers

import (
	"testing"

	"backend/internal/models"
)

// Handler tests live in the internal test package on purpose. The rules worth
// pinning sit in unexported helpers, and reaching them through an HTTP round
// trip would need a Firestore stand-in for very little extra confidence.

// A PATCH must overlay only what the caller sent. Applying the body to the
// stored event and writing the whole document back is only safe if an omitted
// field is genuinely left alone, so that is pinned here.
func TestApplyEventBodyOverlaysOnlySuppliedFields(t *testing.T) {
	s := func(v string) *string { return &v }
	i := func(v int) *int { return &v }

	event := &models.Event{
		Title:                "Original Title",
		Category:             "Technical",
		EventType:            models.EventTypeTeam,
		StartDateTime:        "2026-01-05T10:00:00.000Z",
		RegistrationDeadline: "2026-01-04T10:00:00.000Z",
		MinTeamSize:          2,
		MaxTeamSize:          4,
		RegistrationFee:      models.Fee{Host: 0, Other: 200},
	}

	n := applyEventBody(event, &eventBody{Title: s("New Title"), MaxTeamSize: i(6)})

	if n != 2 {
		t.Errorf("expected two applied fields, got %d", n)
	}
	if event.Title != "New Title" {
		t.Errorf("patch should win: %q", event.Title)
	}
	if event.MaxTeamSize != 6 {
		t.Errorf("maxTeamSize = %d, want 6", event.MaxTeamSize)
	}
	if event.MinTeamSize != 2 {
		t.Errorf("unpatched minTeamSize should survive, got %d", event.MinTeamSize)
	}
	if event.StartDateTime != "2026-01-05T10:00:00.000Z" {
		t.Error("unpatched date should survive")
	}
	if event.RegistrationFee.Other != 200 {
		t.Errorf("unpatched fee should survive, got %d", event.RegistrationFee.Other)
	}
}

// An empty body must be rejected rather than silently rewriting the document.
func TestApplyEventBodyReportsAnEmptyPatch(t *testing.T) {
	event := &models.Event{Title: "Untouched"}
	if n := applyEventBody(event, &eventBody{}); n != 0 {
		t.Errorf("expected no applied fields, got %d", n)
	}
	if event.Title != "Untouched" {
		t.Errorf("an empty patch must not change anything, got %q", event.Title)
	}
}

// A zero value that was explicitly sent has to be written, which is the whole
// reason the body uses pointers.
func TestApplyEventBodyWritesExplicitZeroValues(t *testing.T) {
	b := func(v bool) *bool { return &v }
	i := func(v int) *int { return &v }

	event := &models.Event{IsPublic: true, MaxParticipants: 100}
	applyEventBody(event, &eventBody{IsPublic: b(false), MaxParticipants: i(0)})

	if event.IsPublic {
		t.Error("isPublic false should be applied, not treated as omitted")
	}
	if event.MaxParticipants != 0 {
		t.Errorf("maxParticipants 0 should be applied, got %d", event.MaxParticipants)
	}
}
