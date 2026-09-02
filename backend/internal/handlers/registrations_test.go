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
