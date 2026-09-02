package isotime_test

import (
	"testing"
	"time"

	"backend/internal/isotime"
)

func TestParseAcceptsStoredAndClientFormats(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"2025-11-13T10:30:00.000Z", true}, // the stored format
		{"2026-01-05T10:00:00Z", true},     // plain RFC3339 from a client
		{"2026-01-05T10:00:00.123456Z", true},
		{"2026-01-05T15:30:00+05:30", true}, // an offset is normalised to UTC
		{"13/11/2025", false},
		{"", false},
		{"not a date", false},
	}
	for _, tc := range cases {
		if _, ok := isotime.Parse(tc.in); ok != tc.want {
			t.Errorf("Parse(%q) ok = %v, want %v", tc.in, ok, tc.want)
		}
	}
}

func TestParseNormalisesToUTC(t *testing.T) {
	got, ok := isotime.Parse("2026-01-05T15:30:00+05:30")
	if !ok {
		t.Fatal("an offset timestamp should parse")
	}
	if got.Hour() != 10 || got.Minute() != 0 {
		t.Errorf("expected 10:00 UTC, got %s", got.Format(time.RFC3339))
	}
}

func TestFormatAndParseRoundTrip(t *testing.T) {
	original := time.Date(2026, 1, 5, 10, 30, 0, 0, time.UTC)

	rendered := isotime.Format(original)
	if rendered != "2026-01-05T10:30:00.000Z" {
		t.Fatalf("Format = %q", rendered)
	}
	back, ok := isotime.Parse(rendered)
	if !ok || !back.Equal(original) {
		t.Errorf("round trip lost the instant: %v, ok=%v", back, ok)
	}
}

func TestNowIsFixedWidth(t *testing.T) {
	now := isotime.Now()
	if len(now) != len("2025-11-13T10:30:00.000Z") {
		t.Fatalf("Now() is not fixed width: %q", now)
	}
	if now[len(now)-1] != 'Z' {
		t.Errorf("Now() should be UTC: %q", now)
	}
}

// This is the property the whole storage format exists for. GET /events sorts
// and range-filters on these strings without parsing them, which is only
// correct because the format is fixed-width UTC.
func TestStringOrderMatchesChronologicalOrder(t *testing.T) {
	instants := []time.Time{
		time.Date(2025, 11, 13, 10, 30, 0, 0, time.UTC),
		time.Date(2025, 11, 13, 12, 30, 0, 0, time.UTC),
		time.Date(2025, 12, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 1, 2, 9, 0, 0, 0, time.UTC),
	}
	for i := 1; i < len(instants); i++ {
		earlier, later := isotime.Format(instants[i-1]), isotime.Format(instants[i])
		if !(earlier < later) {
			t.Errorf("string order disagrees with time order: %q should sort before %q", earlier, later)
		}
	}
}
