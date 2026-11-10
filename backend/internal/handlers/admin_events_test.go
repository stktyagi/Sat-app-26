package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"backend/internal/models"
)

func newTestContext() *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	return c
}

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

// The admin edit screen allows every field to be left empty, so a PATCH that
// clears them must pass validation: the merged event validates, not the patch,
// and empty strings are legal values for the optional fields.
func TestValidateEventAcceptsClearedOptionalFieldsOnUpdate(t *testing.T) {
	a := &API{}
	c := newTestContext()

	event := &models.Event{
		Title:                "",
		Category:             "",
		EventType:            "",
		StartDateTime:        "",
		EndDateTime:          "",
		RegistrationDeadline: "",
		VenueID:              "",
		VenueName:            "",
		Coordinators:         []map[string]any{},
		CustomFields:         []models.CustomField{},
	}
	event.Normalise()

	if err := a.validateEvent(c, event, false); err != nil {
		t.Errorf("cleared optional fields should validate on update, got %v", err)
	}

	// An externalLink event keeps its URL optional on update; only create
	// insists on one.
	ext := &models.Event{EventType: models.EventTypeExternalLnk, ExternalURL: ""}
	if err := a.validateEvent(c, ext, false); err != nil {
		t.Errorf("externalLink without a URL should validate on update, got %v", err)
	}
	if err := a.validateEvent(c, ext, true); err == nil {
		t.Error("externalLink without a URL should still fail on create")
	}
}

// Team sizes may be left unset: 0 means no minimum or no maximum, matching
// the store layer's maxParticipants convention. Only entered values are
// checked: negatives are invalid, and a set maximum cannot sit below the
// minimum.
func TestValidateEventTeamSizesOptional(t *testing.T) {
	a := &API{}
	c := newTestContext()

	unset := &models.Event{EventType: models.EventTypeTeam, MinTeamSize: 0, MaxTeamSize: 0}
	if err := a.validateEvent(c, unset, false); err != nil {
		t.Errorf("unset team sizes (0/0) should validate, got %v", err)
	}

	openMax := &models.Event{EventType: models.EventTypeTeam, MinTeamSize: 3, MaxTeamSize: 0}
	if err := a.validateEvent(c, openMax, false); err != nil {
		t.Errorf("a minimum with no maximum should validate, got %v", err)
	}

	negative := &models.Event{EventType: models.EventTypeTeam, MinTeamSize: -1, MaxTeamSize: 4}
	if err := a.validateEvent(c, negative, false); err == nil {
		t.Error("negative team sizes should be rejected")
	}

	inverted := &models.Event{EventType: models.EventTypeTeam, MinTeamSize: 5, MaxTeamSize: 2}
	if err := a.validateEvent(c, inverted, false); err == nil {
		t.Error("minTeamSize above maxTeamSize should still be rejected")
	}
}

// Clearing a field in the admin screen sends an explicit empty value in the
// PATCH body, and an explicit empty must overwrite the stored value - if ""
// were treated as "omitted", clearing a date would silently keep the old
// timestamp. This pins the full bind -> apply chain for cleared values.
func TestPatchWithExplicitEmptyValuesClearsStoredFields(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPatch, "/", strings.NewReader(`{
		"title": "",
		"startDateTime": "",
		"endDateTime": "",
		"registrationDeadline": "",
		"venueName": "",
		"externalUrl": "",
		"minTeamSize": 0,
		"maxTeamSize": 0,
		"maxParticipants": 0
	}`))
	c.Request.Header.Set("Content-Type", "application/json")

	var body eventBody
	if !bind(c, &body) {
		t.Fatal("body with explicit empty values should bind")
	}

	event := &models.Event{
		Title:                "Hackathon",
		StartDateTime:        "2026-01-05T10:00:00Z",
		EndDateTime:          "2026-01-05T18:00:00Z",
		RegistrationDeadline: "2026-01-04T10:00:00Z",
		VenueName:            "Main Audi",
		ExternalURL:          "https://example.com",
		MinTeamSize:          2,
		MaxTeamSize:          5,
		MaxParticipants:      100,
	}

	n := applyEventBody(event, &body)
	if n != 9 {
		t.Errorf("all 9 explicit empty values should count as supplied, got %d", n)
	}
	if event.Title != "" || event.StartDateTime != "" || event.EndDateTime != "" ||
		event.RegistrationDeadline != "" || event.VenueName != "" || event.ExternalURL != "" {
		t.Errorf("cleared strings should overwrite stored values: %+v", event)
	}
	if event.MinTeamSize != 0 || event.MaxTeamSize != 0 || event.MaxParticipants != 0 {
		t.Errorf("cleared numbers should overwrite stored values: %+v", event)
	}
	// SaveEvent writes the whole document with firestore Set, so these empty
	// values are what gets persisted.
}
