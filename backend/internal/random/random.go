// Package random generates the short human-readable codes people have to type
// or read aloud: team invite codes and referral codes.
package random

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
)

// Code returns an upper-case hex string of n characters, drawn from a
// cryptographically secure source. Hex keeps the alphabet small enough that a
// code read out across a noisy room stays unambiguous.
func Code(n int) string {
	if n <= 0 {
		return ""
	}
	b := make([]byte, (n+1)/2)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return strings.ToUpper(hex.EncodeToString(b))[:n]
}
