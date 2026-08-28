package models

import "time"

// TimeFormat is the one format every date field in this database uses:
// "2025-11-13T10:30:00.000Z". It is fixed-width and UTC, which is why plain
// string comparison is a correct ordering for these values and why range
// filters can be pushed into Firestore as string comparisons.
const TimeFormat = "2006-01-02T15:04:05.000Z"

func NowString() string { return time.Now().UTC().Format(TimeFormat) }

func FormatTime(t time.Time) string { return t.UTC().Format(TimeFormat) }

// ParseTime accepts the canonical format first, then falls back to RFC3339 for
// values supplied by API clients, which are not obliged to send milliseconds.
func ParseTime(s string) (time.Time, bool) {
	if s == "" {
		return time.Time{}, false
	}
	for _, layout := range []string{TimeFormat, time.RFC3339Nano, time.RFC3339} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC(), true
		}
	}
	return time.Time{}, false
}

// Before reports whether a stored timestamp string is earlier than t. An
// unparseable or missing value returns false so a malformed deadline never
// silently closes registration.
func Before(stored string, t time.Time) bool {
	parsed, ok := ParseTime(stored)
	return ok && parsed.Before(t)
}
