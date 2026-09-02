// Package isotime handles the one timestamp format this database stores:
// "2025-11-13T10:30:00.000Z", fixed-width and always UTC.
//
// The fixed width is load-bearing. Because every stored timestamp has the same
// number of characters and the same zone, lexicographic string comparison is a
// correct chronological comparison, which is what lets event range filters and
// ordering work on plain strings without parsing anything.
package isotime

import "time"

// Layout is the stored format. Everything written to Firestore uses it.
const Layout = "2006-01-02T15:04:05.000Z"

// Format renders an instant in the stored format.
func Format(t time.Time) string { return t.UTC().Format(Layout) }

// Now is the current instant in the stored format.
func Now() string { return Format(time.Now()) }

// Parse accepts the stored format first, then falls back to RFC3339 for values
// supplied by API clients, which are not obliged to send milliseconds.
func Parse(s string) (time.Time, bool) {
	if s == "" {
		return time.Time{}, false
	}
	for _, layout := range []string{Layout, time.RFC3339Nano, time.RFC3339} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC(), true
		}
	}
	return time.Time{}, false
}
