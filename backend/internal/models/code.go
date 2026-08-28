package models

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
)

// RandomCode returns an uppercase hex code of n characters. Invite codes in the
// existing data look like 0275AA and 1ABCF3, so this matches that shape.
func RandomCode(n int) string {
	b := make([]byte, (n+1)/2)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return strings.ToUpper(hex.EncodeToString(b))[:n]
}
