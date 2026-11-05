package store

import (
	"context"
	"testing"

	"backend/internal/models"
)

func TestCountPaidRegistrationsEmulator(t *testing.T) {
	s := emulatorStore(t)
	ctx := context.Background()

	// 1. Create a free event and a paid event
	freeEventID := "ev-free-" + t.Name()
	paidEventID := "ev-paid-" + t.Name()
	emptyEventID := "ev-empty-" + t.Name()

	freeEv := &models.Event{
		ID:              freeEventID,
		EventID:         freeEventID,
		Title:           "Free Event",
		PaymentRequired: false,
	}
	paidEv := &models.Event{
		ID:              paidEventID,
		EventID:         paidEventID,
		Title:           "Paid Event",
		PaymentRequired: true,
	}
	emptyEv := &models.Event{
		ID:              emptyEventID,
		EventID:         emptyEventID,
		Title:           "Empty Event",
		PaymentRequired: true,
	}

	mustWrite(t)(s.FS.Collection(ColEvents).Doc(freeEventID).Set(ctx, freeEv))
	mustWrite(t)(s.FS.Collection(ColEvents).Doc(paidEventID).Set(ctx, paidEv))
	mustWrite(t)(s.FS.Collection(ColEvents).Doc(emptyEventID).Set(ctx, emptyEv))

	// 2. Add registrations for free event:
	// Free event counts all registrations regardless of paymentStatus
	regFree1 := models.NewRegistration("u1", freeEventID, "", "", 0, nil)
	regFree1.PaymentStatus = models.RegPaymentPending
	mustWrite(t)(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(freeEventID, "u1")).Set(ctx, regFree1))

	regFree2 := models.NewRegistration("u2", freeEventID, "", "", 0, nil)
	regFree2.PaymentStatus = models.RegPaymentSuccess
	mustWrite(t)(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(freeEventID, "u2")).Set(ctx, regFree2))

	// 3. Add registrations for paid event:
	// Paid event only counts registrations where paymentStatus == "success"
	regPaidPending := models.NewRegistration("u3", paidEventID, "", "", 200, nil)
	regPaidPending.PaymentStatus = models.RegPaymentPending
	mustWrite(t)(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(paidEventID, "u3")).Set(ctx, regPaidPending))

	regPaidSuccess := models.NewRegistration("u4", paidEventID, "", "", 200, nil)
	regPaidSuccess.PaymentStatus = models.RegPaymentSuccess
	mustWrite(t)(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(paidEventID, "u4")).Set(ctx, regPaidSuccess))

	// Zero-fee registration for paid event (e.g. 100% discount / host student) with success status
	regPaidZeroFee := models.NewRegistration("u5", paidEventID, "", "", 0, nil)
	regPaidZeroFee.PaymentStatus = models.RegPaymentSuccess
	mustWrite(t)(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(paidEventID, "u5")).Set(ctx, regPaidZeroFee))

	// Failed payment or empty status should not be counted
	regPaidFailed := models.NewRegistration("u6", paidEventID, "", "", 200, nil)
	regPaidFailed.PaymentStatus = "failed"
	mustWrite(t)(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(paidEventID, "u6")).Set(ctx, regPaidFailed))

	regPaidBlank := models.NewRegistration("u7", paidEventID, "", "", 200, nil)
	regPaidBlank.PaymentStatus = ""
	mustWrite(t)(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(paidEventID, "u7")).Set(ctx, regPaidBlank))

	// Test CountPaidRegistrations for free event (should count both pending & success = 2)
	gotFree, err := s.CountPaidRegistrations(ctx, freeEventID)
	if err != nil {
		t.Fatalf("CountPaidRegistrations(free): %v", err)
	}
	if gotFree != 2 {
		t.Errorf("CountPaidRegistrations(free) = %d, want 2", gotFree)
	}

	// Test CountPaidRegistrations for paid event (should count only success: u4 + u5 = 2)
	gotPaid, err := s.CountPaidRegistrations(ctx, paidEventID)
	if err != nil {
		t.Fatalf("CountPaidRegistrations(paid): %v", err)
	}
	if gotPaid != 2 {
		t.Errorf("CountPaidRegistrations(paid) = %d, want 2", gotPaid)
	}

	// Test event with 0 registrations
	gotEmpty, err := s.CountPaidRegistrations(ctx, emptyEventID)
	if err != nil {
		t.Fatalf("CountPaidRegistrations(empty): %v", err)
	}
	if gotEmpty != 0 {
		t.Errorf("CountPaidRegistrations(empty) = %d, want 0", gotEmpty)
	}

	// Test non-existent event (gracefully falls back and returns 0)
	gotNonExistent, err := s.CountPaidRegistrations(ctx, "non-existent-event-id")
	if err != nil {
		t.Fatalf("CountPaidRegistrations(non-existent): %v", err)
	}
	if gotNonExistent != 0 {
		t.Errorf("CountPaidRegistrations(non-existent) = %d, want 0", gotNonExistent)
	}

	// Test CountAllRegistrations
	allCounts, err := s.CountAllRegistrations(ctx, []string{freeEventID, paidEventID, emptyEventID})
	if err != nil {
		t.Fatalf("CountAllRegistrations: %v", err)
	}
	if allCounts[freeEventID] != 2 {
		t.Errorf("CountAllRegistrations[free] = %d, want 2", allCounts[freeEventID])
	}
	if allCounts[paidEventID] != 2 {
		t.Errorf("CountAllRegistrations[paid] = %d, want 2", allCounts[paidEventID])
	}
	if allCounts[emptyEventID] != 0 {
		t.Errorf("CountAllRegistrations[empty] = %d, want 0", allCounts[emptyEventID])
	}
}
