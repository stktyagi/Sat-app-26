// Package email holds the small amount of address handling this API needs.
package email

import "strings"

// HasDomain reports whether an address belongs to a domain, case-insensitively.
// It decides who counts as a host-college student, and therefore what someone
// pays and which events they can enter, so it compares the domain exactly
// rather than by suffix: a lookalike domain must not match.
func HasDomain(address, domain string) bool {
	at := strings.LastIndex(address, "@")
	if at < 0 {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(address[at+1:]), strings.TrimSpace(domain))
}
