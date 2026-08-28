package slug

import (
	"regexp"
	"strings"
)

var nonAlnum = regexp.MustCompile(`[^a-z0-9]+`)

// Make converts an event title into the kebab-case document ID convention the
// events collection already uses, e.g. "3D Printing Workshop" becomes
// "3d-printing-workshop".
func Make(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = nonAlnum.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}
