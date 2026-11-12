package handlers

import (
	"testing"

	"backend/internal/models"
)

func TestNormalizeCheckinStatus(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"checked-in", models.CheckinDone},
		{"checked in", models.CheckinDone},
		{"CHECKED IN", models.CheckinDone},
		{"checked_in", models.CheckinDone},
		{"rejected", models.CheckinRejected},
		{"REJECTED", models.CheckinRejected},
		{"pending", models.CheckinPending},
		{"", models.CheckinPending},
	}

	for _, tc := range tests {
		got := models.NormalizeCheckinStatus(tc.input)
		if got != tc.expected {
			t.Errorf("NormalizeCheckinStatus(%q) = %q; want %q", tc.input, got, tc.expected)
		}
	}
}
