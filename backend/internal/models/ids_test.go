package models

import "testing"

// These ID conventions are inherited from the live data, not chosen here, so
// they are pinned: userEventRegistrations documents are "{eventId}_{userId}"
// and teamRegistrations documents are "{eventId}_{inviteCode}".

func TestRegistrationIDMatchesLiveConvention(t *testing.T) {
	got := RegistrationID("3d-printing-workshop", "0NxY025770W9cPpzHUtTPoulNVJ3")
	want := "3d-printing-workshop_0NxY025770W9cPpzHUtTPoulNVJ3"
	if got != want {
		t.Errorf("RegistrationID = %q, want %q", got, want)
	}
}

func TestTeamRefMatchesLiveConvention(t *testing.T) {
	got := TeamRef("50-hour-film-making", "0275AA")
	want := "50-hour-film-making_0275AA"
	if got != want {
		t.Errorf("TeamRef = %q, want %q", got, want)
	}
	// Codes are accepted in any case but always addressed in upper case.
	if TeamRef("e", "abc123") != "e_ABC123" {
		t.Error("invite codes should be upper-cased into the reference")
	}
}

func TestStatusFor(t *testing.T) {
	if got := StatusFor(1, 3); got != TeamStatusPending {
		t.Errorf("a team below the minimum should be pending, got %q", got)
	}
	if got := StatusFor(3, 3); got != TeamStatusConfirmed {
		t.Errorf("a team at the minimum should be confirmed, got %q", got)
	}
	// Individual events store minTeamSize as 0.
	if got := StatusFor(1, 0); got != TeamStatusConfirmed {
		t.Errorf("no minimum should mean confirmed, got %q", got)
	}
}

func TestRandomCodeShape(t *testing.T) {
	seen := map[string]bool{}
	for range 100 {
		c := RandomCode(6)
		if len(c) != 6 {
			t.Fatalf("code %q is not six characters", c)
		}
		for _, r := range c {
			if !(r >= '0' && r <= '9') && !(r >= 'A' && r <= 'F') {
				t.Fatalf("code %q is not upper-case hex", c)
			}
		}
		seen[c] = true
	}
	if len(seen) < 90 {
		t.Errorf("codes look insufficiently random: %d unique out of 100", len(seen))
	}
}

func TestParseTimeAcceptsStoredAndClientFormats(t *testing.T) {
	if _, ok := ParseTime("2025-11-13T10:30:00.000Z"); !ok {
		t.Error("the stored format should parse")
	}
	if _, ok := ParseTime("2026-01-05T10:00:00Z"); !ok {
		t.Error("plain RFC3339 from a client should parse")
	}
	if _, ok := ParseTime("13/11/2025"); ok {
		t.Error("a non-RFC3339 value should be rejected")
	}
}

// The stored format is fixed-width UTC, which is what makes lexicographic
// comparison a correct chronological comparison. GET /events relies on this for
// its from/to filters and its ordering.
func TestStoredFormatSortsChronologically(t *testing.T) {
	earlier := "2025-11-13T10:30:00.000Z"
	later := "2025-11-13T12:30:00.000Z"
	nextYear := "2026-01-02T09:00:00.000Z"

	if !(earlier < later && later < nextYear) {
		t.Error("string ordering does not match chronological ordering")
	}
}
