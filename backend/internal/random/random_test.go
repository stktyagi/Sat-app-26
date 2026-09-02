package random_test

import (
	"testing"

	"backend/internal/random"
)

// Invite codes are read aloud and typed in, so the alphabet and the length are
// part of the contract, not an implementation detail.
func TestCodeShape(t *testing.T) {
	for _, n := range []int{1, 4, 6, 8, 15} {
		c := random.Code(n)
		if len(c) != n {
			t.Errorf("Code(%d) returned %d characters: %q", n, len(c), c)
		}
		for _, r := range c {
			if !(r >= '0' && r <= '9') && !(r >= 'A' && r <= 'F') {
				t.Errorf("Code(%d) = %q is not upper-case hex", n, c)
				break
			}
		}
	}
	if got := random.Code(0); got != "" {
		t.Errorf("Code(0) = %q, want empty", got)
	}
	if got := random.Code(-1); got != "" {
		t.Errorf("Code(-1) = %q, want empty", got)
	}
}

// A collision costs a retry when a team is created, so the codes have to be
// spread across the space rather than clustered.
func TestCodeIsNotObviouslyPredictable(t *testing.T) {
	const draws = 500
	seen := make(map[string]bool, draws)
	for range draws {
		seen[random.Code(6)] = true
	}
	if len(seen) < draws-2 {
		t.Errorf("codes look insufficiently random: %d unique out of %d", len(seen), draws)
	}
}
