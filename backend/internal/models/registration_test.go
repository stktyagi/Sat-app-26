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

	if reg.Status != models.RegStatusPending {
		t.Errorf("status = %q, want pending for unconfirmed team", reg.Status)
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
	if reg.Status != models.RegStatusConfirmed {
		t.Errorf("status = %q, want confirmed for free individual registration", reg.Status)
	}
}

func TestResolveRegistrationStatus(t *testing.T) {
	// Conflict priority: Pending > Payment pending
	// 1. Team size incomplete: always pending regardless of payment
	if got := models.ResolveRegistrationStatus(false, false, ""); got != models.RegStatusPending {
		t.Errorf("size incomplete & payment incomplete: got %q, want pending", got)
	}
	if got := models.ResolveRegistrationStatus(false, true, ""); got != models.RegStatusPending {
		t.Errorf("size incomplete & payment complete: got %q, want pending", got)
	}

	// 2. Team size complete, but payment incomplete: payment_pending
	if got := models.ResolveRegistrationStatus(true, false, ""); got != models.RegStatusPaymentPending {
		t.Errorf("size complete & payment incomplete: got %q, want payment_pending", got)
	}

	// 3. Team size complete & payment complete: confirmed
	if got := models.ResolveRegistrationStatus(true, true, ""); got != models.RegStatusConfirmed {
		t.Errorf("size complete & payment complete: got %q, want confirmed", got)
	}

	// 4. Manually rejected registration remains rejected
	if got := models.ResolveRegistrationStatus(true, true, models.RegStatusRejected); got != models.RegStatusRejected {
		t.Errorf("rejected status should remain rejected, got %q", got)
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
