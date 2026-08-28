package handlers

import (
	"testing"

	"backend/internal/models"
)

// The events collection accumulated duplicate spellings across two generations
// of admin panel. Writing only the canonical name would make those fields
// render blank in the older web admin panel, so every write mirrors the legacy
// spelling too. This pins that contract.
func TestApplyEventBodyMirrorsLegacyFieldNames(t *testing.T) {
	s := func(v string) *string { return &v }
	b := func(v bool) *bool { return &v }

	doc := map[string]any{}
	applyEventBody(doc, &eventBody{
		CoverImage:       s("https://example.test/cover.jpg"),
		StartDateTime:    s("2026-01-05T10:00:00.000Z"),
		RequiresApproval: b(true),
		PaymentRequired:  b(true),
		RegistrationFee:  &models.Fee{Host: 10, Other: 20},
	})

	pairs := []struct{ canonical, legacy string }{
		{"coverImage", "coverImageUrl"},
		{"startDateTime", "dateTime"},
		{"requiresApproval", "requireAdminApproval"},
		{"paymentRequired", "paymentEnabled"},
	}
	for _, p := range pairs {
		if doc[p.canonical] != doc[p.legacy] {
			t.Errorf("%s (%v) and %s (%v) should be written together",
				p.canonical, doc[p.canonical], p.legacy, doc[p.legacy])
		}
	}

	fee, ok := doc["registrationFee"].(map[string]any)
	if !ok || fee["host"] != 10 || fee["other"] != 20 {
		t.Fatalf("registrationFee map not written: %#v", doc["registrationFee"])
	}
	// hostFee was stored as a string on the older documents.
	if doc["hostFee"] != "10" {
		t.Errorf("hostFee should mirror as a string, got %#v", doc["hostFee"])
	}
	if doc["otherFee"] != 20 {
		t.Errorf("otherFee should mirror as a number, got %#v", doc["otherFee"])
	}
}

// An omitted field must not be written at all, otherwise PATCH would blank out
// everything the caller did not mention.
func TestApplyEventBodyIgnoresOmittedFields(t *testing.T) {
	title := "Only The Title"
	doc := map[string]any{}
	applyEventBody(doc, &eventBody{Title: &title})

	if len(doc) != 1 {
		t.Errorf("expected exactly one field, got %#v", doc)
	}
	if doc["title"] != "Only The Title" {
		t.Errorf("title = %#v", doc["title"])
	}
}

// A partial update has to be validated against the merged document, or a patch
// that moves only the start date could silently leave the deadline after it.
func TestMergeForValidationOverlaysPatch(t *testing.T) {
	existing := &models.Event{
		Category:             "Technical",
		EventType:            models.EventTypeTeam,
		StartDateTime:        "2026-01-05T10:00:00.000Z",
		RegistrationDeadline: "2026-01-04T10:00:00.000Z",
		MinTeamSize:          2,
		MaxTeamSize:          4,
	}
	merged := mergeForValidation(existing, map[string]any{"maxTeamSize": 6})

	if models.Int(merged["maxTeamSize"]) != 6 {
		t.Errorf("patch should win: %#v", merged["maxTeamSize"])
	}
	if models.Int(merged["minTeamSize"]) != 2 {
		t.Errorf("unpatched field should survive: %#v", merged["minTeamSize"])
	}
	if models.Str(merged["startDateTime"]) != existing.StartDateTime {
		t.Error("unpatched date should survive")
	}
}

func TestValidateResponsesRequiresAnsweredFields(t *testing.T) {
	event := &models.Event{CustomFields: []models.CustomField{
		{FieldID: "tshirt", Label: "T-shirt size", Required: true},
		{FieldID: "notes", Label: "Anything else", Required: false},
	}}

	if err := validateResponses(event, nil); err == nil {
		t.Error("a missing required answer should be rejected")
	}
	if err := validateResponses(event, []models.Response{{FieldID: "tshirt", Value: ""}}); err == nil {
		t.Error("an empty required answer should be rejected")
	}
	if err := validateResponses(event, []models.Response{{FieldID: "tshirt", Value: "L"}}); err != nil {
		t.Errorf("a satisfied requirement should pass, got %v", err)
	}
	// An event with no custom fields accepts anything.
	if err := validateResponses(&models.Event{}, nil); err != nil {
		t.Errorf("an event without custom fields should accept no answers, got %v", err)
	}
}

func TestSortEvents(t *testing.T) {
	mk := func(id, start string, featured bool) *models.Event {
		return &models.Event{ID: id, StartDateTime: start, IsFeatured: featured}
	}
	list := []*models.Event{
		mk("c", "2026-01-07T10:00:00.000Z", false),
		mk("a", "2026-01-05T10:00:00.000Z", false),
		mk("b", "2026-01-06T10:00:00.000Z", true),
	}

	sortEvents(list, "")
	if list[0].ID != "a" || list[2].ID != "c" {
		t.Errorf("default sort should be chronological, got %s %s %s", list[0].ID, list[1].ID, list[2].ID)
	}

	sortEvents(list, "-startDateTime")
	if list[0].ID != "c" {
		t.Errorf("descending sort should start at the latest, got %s", list[0].ID)
	}

	sortEvents(list, "featured")
	if list[0].ID != "b" {
		t.Errorf("featured sort should lead with the featured event, got %s", list[0].ID)
	}
	if list[1].ID != "a" {
		t.Errorf("featured sort should stay chronological below the fold, got %s", list[1].ID)
	}
}
