package storage

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"backend/internal/cache"
)

// newTestStore writes accounts to a temp credentials file and opens a Store
// over an in-memory counter. Nothing here touches the network: New only builds
// SDK handles, and signing is a local HMAC.
func newTestStore(t *testing.T, accounts ...account) (*Store, *cache.Memory) {
	t.Helper()

	mem := cache.NewMemory()
	s, err := New(writeAccounts(t, accounts), mem)
	if err != nil {
		t.Fatalf("opening a store over %d valid accounts should succeed, got %v", len(accounts), err)
	}
	return s, mem
}

func writeAccounts(t *testing.T, accounts any) string {
	t.Helper()

	b, err := json.Marshal(accounts)
	if err != nil {
		t.Fatalf("marshalling test accounts: %v", err)
	}
	path := filepath.Join(t.TempDir(), "imagekit.json")
	if err := os.WriteFile(path, b, 0o600); err != nil {
		t.Fatalf("writing test accounts: %v", err)
	}
	return path
}

func testAccount(id string, quota int64) account {
	return account{
		ID:          id,
		URLEndpoint: "https://ik.imagekit.io/" + id,
		PrivateKey:  "private_" + id,
		QuotaBytes:  quota,
	}
}

func seedUsed(t *testing.T, mem *cache.Memory, id string, n int64) {
	t.Helper()
	if _, err := mem.IncrBy(context.Background(), usedKeyPrefix+id, n); err != nil {
		t.Fatalf("seeding usage for %q: %v", id, err)
	}
}

func TestAReferenceSurvivesARoundTrip(t *testing.T) {
	s, _ := newTestStore(t, testAccount("ik1", 100))

	// A nested path, and one with the separator in it, which SplitN's field
	// limit is there to keep in the path rather than break the parse on.
	for _, path := range []string{"/events/poster_x7fK2p.jpg", "/a/b/c/od|d.pdf"} {
		ref := strings.Join([]string{"ik1", "68af3c9d", "402118", path}, refSep)

		a, fileID, size, gotPath, err := s.resolve(ref)
		if err != nil {
			t.Fatalf("resolving %q should succeed, got %v", ref, err)
		}
		if a.ID != "ik1" || fileID != "68af3c9d" || size != 402118 || gotPath != path {
			t.Errorf("round trip of %q lost something: got account %q, file %q, size %d, path %q",
				ref, a.ID, fileID, size, gotPath)
		}
	}
}

func TestAMalformedReferenceIsRejected(t *testing.T) {
	s, _ := newTestStore(t, testAccount("ik1", 100))

	cases := map[string]string{
		"too few fields":     "ik1|68af3c9d|/events/poster.jpg",
		"empty":              "",
		"a non-numeric size": "ik1|68af3c9d|huge|/events/poster.jpg",
	}
	for name, ref := range cases {
		if _, _, _, _, err := s.resolve(ref); !errors.Is(err, ErrBadRef) {
			t.Errorf("a reference with %s should be ErrBadRef, got %v", name, err)
		}
	}

	// An unknown account is a different failure: the reference is well formed,
	// the account it names is just not configured any more.
	_, _, _, _, err := s.resolve("ik9|68af3c9d|100|/events/poster.jpg")
	if err == nil || errors.Is(err, ErrBadRef) {
		t.Errorf("a reference naming an unconfigured account should fail on its own terms, got %v", err)
	}
}

func TestUploadsGoToTheAccountWithTheMostRoomLeft(t *testing.T) {
	// Unequal quotas, chosen so the two plausible rules disagree: ik2 is much
	// emptier by percentage, ik1 has more bytes free. Free bytes wins.
	s, mem := newTestStore(t, testAccount("ik1", 100), testAccount("ik2", 20))
	seedUsed(t, mem, "ik1", 50) // 50 free, 50% used
	seedUsed(t, mem, "ik2", 4)  // 16 free, 20% used

	a, err := s.pick(context.Background())
	if err != nil {
		t.Fatalf("picking an account should succeed while both have room, got %v", err)
	}
	if a.ID != "ik1" {
		t.Errorf("ik1 has 50 bytes free and ik2 only 16, so ik1 should win; picked %q", a.ID)
	}
}

func TestAnAccountWithNoCounterYetCountsAsEmpty(t *testing.T) {
	s, mem := newTestStore(t, testAccount("ik1", 100), testAccount("ik2", 100))
	seedUsed(t, mem, "ik1", 90)

	a, err := s.pick(context.Background())
	if err != nil {
		t.Fatalf("picking an account should succeed, got %v", err)
	}
	if a.ID != "ik2" {
		t.Errorf("ik2 has never been written to, so it should look empty and win; picked %q", a.ID)
	}
}

func TestPickingFailsOnceEveryAccountIsFull(t *testing.T) {
	s, mem := newTestStore(t, testAccount("ik1", 100), testAccount("ik2", 20))
	seedUsed(t, mem, "ik1", 100) // exactly full
	seedUsed(t, mem, "ik2", 25)  // over, as ImageKit's own accounting may disagree with ours

	if _, err := s.pick(context.Background()); !errors.Is(err, ErrNoSpace) {
		t.Errorf("picking with every account full should be ErrNoSpace, got %v", err)
	}
}

func TestASignedURLCarriesAnExpiryAndSignature(t *testing.T) {
	s, _ := newTestStore(t, testAccount("ik1", 100), testAccount("ik2", 100))

	raw, err := s.SignedURL("ik2|68af3c9d|402118|/events/poster.jpg", 15*time.Minute)
	if err != nil {
		t.Fatalf("signing a well formed reference should succeed, got %v", err)
	}

	u, err := parseSigned(t, raw)
	if err != nil {
		t.Fatalf("SignedURL should return a parseable url, got %q: %v", raw, err)
	}
	if !strings.HasPrefix(raw, "https://ik.imagekit.io/ik2/") {
		t.Errorf("the url should be built on the endpoint of the account in the reference, got %q", raw)
	}
	if !strings.Contains(u.Path, "poster.jpg") {
		t.Errorf("the url should point at the file in the reference, got %q", raw)
	}
	if u.Query().Get("ik-t") == "" || u.Query().Get("ik-s") == "" {
		t.Errorf("a signed url needs both ik-t and ik-s, got %q", raw)
	}
}

func TestADifferentExpiryProducesADifferentSignature(t *testing.T) {
	s, _ := newTestStore(t, testAccount("ik1", 100))
	ref := "ik1|68af3c9d|402118|/events/poster.jpg"

	// The expiry is signed along with the path, so two different lifetimes
	// cannot share a signature. If they did, the expiry would be a suggestion.
	short, err := s.SignedURL(ref, time.Minute)
	if err != nil {
		t.Fatalf("signing with a one minute ttl: %v", err)
	}
	long, err := s.SignedURL(ref, time.Hour)
	if err != nil {
		t.Fatalf("signing with a one hour ttl: %v", err)
	}

	su, _ := parseSigned(t, short)
	lu, _ := parseSigned(t, long)
	if su.Query().Get("ik-t") == lu.Query().Get("ik-t") {
		t.Errorf("a one minute and a one hour url should expire at different times, both %q", su.Query().Get("ik-t"))
	}
	if su.Query().Get("ik-s") == lu.Query().Get("ik-s") {
		t.Errorf("urls expiring at different times must not share a signature, both %q", su.Query().Get("ik-s"))
	}
}

func TestSigningRefusesANonExpiringURL(t *testing.T) {
	s, _ := newTestStore(t, testAccount("ik1", 100))
	ref := "ik1|68af3c9d|402118|/events/poster.jpg"

	// ImageKit treats a zero lifetime as "valid forever" and drops ik-t, so a
	// caller passing an unset duration would get a permanent url and no hint
	// that anything went wrong.
	for _, ttl := range []time.Duration{0, -time.Minute} {
		if raw, err := s.SignedURL(ref, ttl); err == nil {
			t.Errorf("a ttl of %s should be refused, got the url %q", ttl, raw)
		}
	}
}

func parseSigned(t *testing.T, raw string) (*url.URL, error) {
	t.Helper()
	return url.Parse(raw)
}

func TestNewRefusesAnUnusableAccountsFile(t *testing.T) {
	valid := testAccount("ik1", 100)

	cases := []struct {
		name     string
		accounts []account
	}{
		{"no accounts at all", []account{}},
		{"an account with no id", []account{{URLEndpoint: "https://e", PrivateKey: "p", QuotaBytes: 1}}},
		{"an id holding the reference separator", []account{{ID: "ik|1", URLEndpoint: "https://e", PrivateKey: "p", QuotaBytes: 1}}},
		{"a missing url endpoint", []account{{ID: "ik1", PrivateKey: "p", QuotaBytes: 1}}},
		{"a missing private key", []account{{ID: "ik1", URLEndpoint: "https://e", QuotaBytes: 1}}},
		{"a zero quota", []account{{ID: "ik1", URLEndpoint: "https://e", PrivateKey: "p"}}},
		{"a duplicate id", []account{valid, valid}},
	}
	for _, tc := range cases {
		if _, err := New(writeAccounts(t, tc.accounts), cache.NewMemory()); err == nil {
			t.Errorf("a credentials file with %s should stop the boot, but New succeeded", tc.name)
		}
	}

	if _, err := New(filepath.Join(t.TempDir(), "absent.json"), cache.NewMemory()); err == nil {
		t.Error("a missing credentials file should stop the boot, but New succeeded")
	}
	if _, err := New(writeAccounts(t, "not an array"), cache.NewMemory()); err == nil {
		t.Error("a credentials file that is not an array of accounts should stop the boot, but New succeeded")
	}
}
