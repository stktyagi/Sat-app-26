package handlers

import (
	"testing"

	"backend/internal/models"
)

func TestValidateResponsesRequiresAnsweredFields(t *testing.T) {
	event := &models.Event{CustomFields: []models.CustomField{
		{FieldID: "tshirt", Label: "T-shirt size", Required: true},
		{FieldID: "notes", Label: "Anything else", Required: false},
	}}

	if err := validateResponses(event, nil, nil); err == nil {
		t.Error("a missing required answer should be rejected")
	}
	if err := validateResponses(event, nil, []models.Response{{FieldID: "tshirt", Value: ""}}); err == nil {
		t.Error("an empty required answer should be rejected")
	}
	if err := validateResponses(event, nil, []models.Response{{FieldID: "tshirt", Value: "L"}}); err != nil {
		t.Errorf("a satisfied requirement should pass, got %v", err)
	}
	// An event with no custom fields accepts anything.
	if err := validateResponses(&models.Event{}, nil, nil); err != nil {
		t.Errorf("an event without custom fields should accept no answers, got %v", err)
	}
}

func TestValidateResponsesHostOnly(t *testing.T) {
	event := &models.Event{CustomFields: []models.CustomField{
		{FieldID: "track", Label: "Track", Required: true},
		{FieldID: "ppt_drive_link", Label: "Deck", Required: true, HostOnly: true},
	}}

	hostUser := &models.User{IsHostCollegeStudent: true}
	outsideUser := &models.User{IsHostCollegeStudent: false}

	// Host user missing ppt_drive_link must fail
	if err := validateResponses(event, hostUser, []models.Response{{FieldID: "track", Value: "AI"}}); err == nil {
		t.Error("host user missing ppt_drive_link should be rejected")
	}
	// Host user providing ppt_drive_link passes
	if err := validateResponses(event, hostUser, []models.Response{{FieldID: "track", Value: "AI"}, {FieldID: "ppt_drive_link", Value: "https://drive.google.com"}}); err != nil {
		t.Errorf("host user with both fields should pass, got %v", err)
	}

	// Outside user missing ppt_drive_link must pass
	if err := validateResponses(event, outsideUser, []models.Response{{FieldID: "track", Value: "AI"}}); err != nil {
		t.Errorf("outside user without host-only field should pass, got %v", err)
	}
}
