package models_test

import (
	"testing"

	"backend/internal/models"
)

// The document ID is derived from the pair, which is what makes a Create with a
// must-not-exist precondition the double-registration guard.
func TestRegistrationID(t *testing.T) {
	got := models.RegistrationID("3d-printing-workshop", "0NxY025770W9cPpzHUtTPoulNVJ3")
	want := "3d-printing-workshop_0NxY025770W9cPpzHUtTPoulNVJ3"
	if got != want {
		t.Errorf("RegistrationID = %q, want %q", got, want)
	}
}

func TestNewRegistrationRecordsTheFeeWithoutCollectingIt(t *testing.T) {
	reg := models.NewRegistration("u1", "sathack", "sathack_0275AA", "0275AA", 200, nil)

	if reg.Status != models.RegStatusConfirmed {
		t.Errorf("status = %q, want confirmed while payments are not enforced", reg.Status)
	}
	if reg.CheckingStatus != models.CheckinPending {
		t.Errorf("checkingStatus = %q, want pending", reg.CheckingStatus)
	}
	if reg.PaymentDetails["amount"] != 200 {
		t.Errorf("the computed fee should be recorded, got %v", reg.PaymentDetails["amount"])
	}
	if reg.Responses == nil {
		t.Error("responses should serialise as [] rather than null")
	}
	if reg.RegisteredAt == "" {
		t.Error("registeredAt should be stamped")
	}
}

// An individual registration carries no team, and the JSON tags omit both
// fields so the client never sees an empty teamId.
func TestNewRegistrationWithoutATeam(t *testing.T) {
	reg := models.NewRegistration("u1", "sathack", "", "", 0, nil)

	if reg.TeamID != "" || reg.TeamInviteCode != "" {
		t.Errorf("an individual registration should carry no team, got %q / %q", reg.TeamID, reg.TeamInviteCode)
	}
}

func TestRegistrationNormaliseFillsEmptyFields(t *testing.T) {
	reg := &models.Registration{}
	reg.Normalise()

	if reg.Responses == nil || reg.PaymentDetails == nil {
		t.Error("Normalise should replace nil collections so they serialise as empty")
	}
	if reg.CheckingStatus != models.CheckinPending {
		t.Errorf("a blank check-in status should default to pending, got %q", reg.CheckingStatus)
	}
}
