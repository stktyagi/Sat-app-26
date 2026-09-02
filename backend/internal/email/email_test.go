package email_test

import (
	"testing"

	"backend/internal/email"
)

// This decides what someone pays and which events they can enter, so the
// lookalike cases matter as much as the happy path.
func TestHasDomain(t *testing.T) {
	cases := []struct {
		address string
		want    bool
	}{
		{"student@thapar.edu", true},
		{"STUDENT@THAPAR.EDU", true},
		{"Student@Thapar.Edu", true},
		{" student@thapar.edu ", true},

		{"someone@gmail.com", false},
		{"someone@notthapar.edu", false}, // suffix match must not pass
		{"someone@thapar.edu.evil.com", false},
		{"someone@sub.thapar.edu", false}, // a subdomain is a different domain
		{"thapar.edu", false},             // no address at all
		{"", false},
		{"@thapar.edu", true},    // degenerate but unambiguous
		{"a@b@thapar.edu", true}, // the last @ wins
	}
	for _, tc := range cases {
		if got := email.HasDomain(tc.address, "thapar.edu"); got != tc.want {
			t.Errorf("HasDomain(%q) = %v, want %v", tc.address, got, tc.want)
		}
	}
}
