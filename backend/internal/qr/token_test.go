package qr

import (
	"strings"
	"testing"
)

const registrationID = "3d-printing-workshop_0NxY025770W9cPpzHUtTPoulNVJ3"

func TestSignThenVerifyRoundTrips(t *testing.T) {
	s := New([]byte("test-secret"))

	got, err := s.Verify(s.Sign(registrationID))
	if err != nil {
		t.Fatalf("Verify returned %v", err)
	}
	if got != registrationID {
		t.Errorf("Verify = %q, want %q", got, registrationID)
	}
}

func TestTamperedTokenIsRejected(t *testing.T) {
	s := New([]byte("test-secret"))
	token := s.Sign(registrationID)

	payload, sig, _ := strings.Cut(token, ".")

	// A different registration ID carrying the original signature.
	forged := New([]byte("test-secret")).Sign("some-other-event_someoneelse")
	forgedPayload, _, _ := strings.Cut(forged, ".")
	if _, err := s.Verify(forgedPayload + "." + sig); err == nil {
		t.Error("a swapped payload should not verify")
	}

	// A mangled signature.
	if _, err := s.Verify(payload + ".YWJjZGVm"); err == nil {
		t.Error("a mangled signature should not verify")
	}

	// A token signed with a different secret.
	other := New([]byte("another-secret"))
	if _, err := s.Verify(other.Sign(registrationID)); err == nil {
		t.Error("a token from a different secret should not verify")
	}
}

func TestMalformedTokensAreRejected(t *testing.T) {
	s := New([]byte("test-secret"))
	for _, token := range []string{"", "nodot", ".", "!!!.!!!", "abc."} {
		if _, err := s.Verify(token); err == nil {
			t.Errorf("Verify(%q) should have failed", token)
		}
	}
}

// The raw registration ID is recoverable from the token, so a scanner built
// against last year's document IDs still finds the document.
func TestPayloadCarriesTheRegistrationID(t *testing.T) {
	s := New([]byte("test-secret"))
	token := s.Sign(registrationID)

	if strings.Count(token, ".") != 1 {
		t.Fatalf("expected exactly one separator in %q", token)
	}
	id, err := s.Verify(token)
	if err != nil || id != registrationID {
		t.Errorf("could not recover the registration ID: %q, %v", id, err)
	}
}
