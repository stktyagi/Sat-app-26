// Package storage spreads file uploads across several ImageKit accounts and
// hands back expiring signed URLs for them.
//
// The reason it exists is quota: one free ImageKit account is small, several
// together are not, and nothing in ImageKit joins them. So this package picks
// an account per upload and remembers how much it has put on each one.
//
// Two decisions are worth knowing before reading the code.
//
// First, there is no file-to-account lookup table. The account ID is encoded
// into the reference string the caller stores alongside its own data, so the
// account is derivable from the reference itself. A lookup table would be a
// second source of truth that, if it were ever lost, would orphan every file
// it described — unreachable and unsignable, even though the bytes are still
// sitting on ImageKit. There is deliberately nothing here to lose.
//
// Second, the per-account byte counters live in the shared cache rather than
// in this process. In-memory counters reset on every deploy, and a counter
// that reads zero makes "pick the emptiest account" collapse into "always pick
// the first one" — the feature silently stops working while still appearing
// to. Redis is already required for the API to boot, so the counters cost one
// INCRBY per upload and survive both restarts and multiple instances.
package storage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	imagekit "github.com/imagekit-developer/imagekit-go/v2"
	"github.com/imagekit-developer/imagekit-go/v2/lib"
	"github.com/imagekit-developer/imagekit-go/v2/option"
	"github.com/imagekit-developer/imagekit-go/v2/shared"

	"backend/internal/cache"
)

// ErrNoSpace means every configured account is at or over its quota. It is a
// sentinel because the caller's response to it (alert someone, add an account)
// is different from its response to a transport failure.
var ErrNoSpace = errors.New("storage: every account is full")

// ErrBadRef means a reference did not come from Upload, or was corrupted on
// its way to wherever the caller kept it.
var ErrBadRef = errors.New("storage: malformed reference")

// refSep separates the fields of a reference. It cannot appear in an account
// ID (New rejects that) and ImageKit does not put it in a file path, so
// splitting on it with a field limit is unambiguous.
const refSep = "|"

// usedKeyPrefix is joined with an account ID to key that account's running
// byte total. It is passed bare: cache.Redis applies the deployment namespace
// itself, so two environments sharing a Redis do not share counters.
const usedKeyPrefix = "ik:used:"

// counters is the slice of the cache this package needs, declared here rather
// than taken as a cache.Provider, the same way store.eventSource is declared
// by its consumer. Both cache.Redis and cache.Memory satisfy it.
type counters interface {
	IncrBy(ctx context.Context, key string, n int64) (int64, error)
	Get(ctx context.Context, key string) ([]byte, error)
}

// account is one entry of the credentials JSON. publicKey is intentionally
// absent: it is only needed to mint client-side upload tokens, which nothing
// does. Unknown keys in the file are ignored, so leaving it in the JSON is
// harmless.
type account struct {
	ID          string `json:"id"`
	URLEndpoint string `json:"urlEndpoint"`
	PrivateKey  string `json:"privateKey"`
	QuotaBytes  int64  `json:"quotaBytes"`
}

// acct pairs an account with the two SDK handles built from its private key.
// Both are cheap value types, but building them once keeps Upload and
// SignedURL free of setup.
type acct struct {
	account
	client imagekit.Client
	helper lib.HelperService
}

// Store holds every configured ImageKit account.
type Store struct {
	accts []*acct
	byID  map[string]*acct
	c     counters
}

// New reads the credentials JSON at path and prepares a client per account.
// It validates eagerly, because a typo in an account entry should stop a
// deployment rather than surface as a failed upload later.
func New(accountsFile string, c counters) (*Store, error) {
	b, err := os.ReadFile(accountsFile)
	if err != nil {
		return nil, fmt.Errorf("reading imagekit accounts: %w", err)
	}

	var accounts []account
	if err := json.Unmarshal(b, &accounts); err != nil {
		return nil, fmt.Errorf("parsing imagekit accounts in %q: %w", accountsFile, err)
	}
	if len(accounts) == 0 {
		return nil, fmt.Errorf("imagekit accounts in %q: file holds no accounts", accountsFile)
	}

	s := &Store{
		accts: make([]*acct, 0, len(accounts)),
		byID:  make(map[string]*acct, len(accounts)),
		c:     c,
	}

	for i, a := range accounts {
		switch {
		case a.ID == "":
			return nil, fmt.Errorf("imagekit account %d: id is required", i)
		case strings.Contains(a.ID, refSep):
			return nil, fmt.Errorf("imagekit account %q: id must not contain %q", a.ID, refSep)
		case a.URLEndpoint == "":
			return nil, fmt.Errorf("imagekit account %q: urlEndpoint is required", a.ID)
		case a.PrivateKey == "":
			return nil, fmt.Errorf("imagekit account %q: privateKey is required", a.ID)
		case a.QuotaBytes <= 0:
			return nil, fmt.Errorf("imagekit account %q: quotaBytes must be positive", a.ID)
		}
		if _, dup := s.byID[a.ID]; dup {
			return nil, fmt.Errorf("imagekit account %q: duplicate id", a.ID)
		}

		entry := &acct{
			account: a,
			client:  imagekit.NewClient(option.WithPrivateKey(a.PrivateKey)),
			helper:  lib.NewHelperService(option.WithPrivateKey(a.PrivateKey)),
		}
		s.accts = append(s.accts, entry)
		s.byID[a.ID] = entry
	}

	return s, nil
}

// Upload stores r under folder and returns a reference to pass back to
// SignedURL or Delete. ImageKit appends a random suffix to name, so callers
// never have to make names unique themselves.
//
// The returned reference is opaque and safe to persist; treat it as a string
// and do not parse it outside this package.
func (s *Store) Upload(ctx context.Context, folder, name string, r io.Reader) (string, error) {
	a, err := s.pick(ctx)
	if err != nil {
		return "", err
	}

	res, err := a.client.Files.Upload(ctx, imagekit.FileUploadParams{
		File:              r,
		FileName:          name,
		Folder:            imagekit.String(folder),
		UseUniqueFileName: imagekit.Bool(true),
	})
	if err != nil {
		return "", fmt.Errorf("uploading to imagekit account %q: %w", a.ID, err)
	}

	size := int64(res.Size)
	// Best effort on purpose. The file is on ImageKit by now, so returning an
	// error here would report a failure that did not happen and orphan it. A
	// lost increment costs a slightly stale picture of how full this account
	// is, which self-corrects on the next successful upload. Same policy as
	// store.ListCache.Invalidate.
	if _, err := s.c.IncrBy(ctx, usedKeyPrefix+a.ID, size); err != nil {
		log.Printf("storage: counting %d bytes onto imagekit account %q: %v", size, a.ID, err)
	}

	return strings.Join([]string{a.ID, res.FileID, strconv.FormatInt(size, 10), res.FilePath}, refSep), nil
}

// SignedURL returns a URL for ref that stops working after ttl. Signing is a
// local HMAC, so this makes no network call and needs no context.
func (s *Store) SignedURL(ref string, ttl time.Duration) (string, error) {
	// Refused rather than passed through: the SDK reads a zero or negative
	// lifetime as "never expires" and omits ik-t entirely, so a caller that
	// forgot to set a duration would quietly mint permanent URLs instead of
	// getting an error. Fail loudly on the one input whose failure is silent.
	if ttl <= 0 {
		return "", fmt.Errorf("storage: a signed url needs a positive ttl, got %s", ttl)
	}

	a, _, _, path, err := s.resolve(ref)
	if err != nil {
		return "", err
	}

	url := a.helper.BuildURL(shared.SrcOptionsParam{
		Src:         path,
		URLEndpoint: a.URLEndpoint,
		Signed:      imagekit.Bool(true),
		ExpiresIn:   imagekit.Float(ttl.Seconds()),
	})
	if url == "" {
		return "", fmt.Errorf("storage: could not build a url for %q", ref)
	}
	return url, nil
}

// Delete removes the file ref points at and credits its bytes back to the
// account that held it.
func (s *Store) Delete(ctx context.Context, ref string) error {
	a, fileID, size, _, err := s.resolve(ref)
	if err != nil {
		return err
	}

	if err := a.client.Files.Delete(ctx, fileID); err != nil {
		return fmt.Errorf("deleting %q from imagekit account %q: %w", fileID, a.ID, err)
	}

	// Best effort for the same reason as in Upload: the file is already gone.
	if _, err := s.c.IncrBy(ctx, usedKeyPrefix+a.ID, -size); err != nil {
		log.Printf("storage: crediting %d bytes back to imagekit account %q: %v", size, a.ID, err)
	}
	return nil
}

// Usage reports how many bytes each account is currently believed to hold,
// keyed by account ID. It is what cmd/ikcheck reads to show that an upload
// actually moved a counter, and keeps the key layout in one place rather than
// having a second caller guess at it.
func (s *Store) Usage(ctx context.Context) map[string]int64 {
	out := make(map[string]int64, len(s.accts))
	for _, a := range s.accts {
		out[a.ID] = s.used(ctx, a.ID)
	}
	return out
}

// pick returns the account with the most free bytes.
//
// It compares free space rather than percentage used because what matters is
// whether a file will fit, and with uneven quotas the emptiest account by
// percentage can be the one with less room left. There is no check that this
// particular upload fits: the size of an io.Reader is not knowable before
// reading it, and reading it here to find out would mean buffering every file
// in memory. ImageKit rejects an over-quota upload itself, which is the case
// this would have been guarding against anyway.
func (s *Store) pick(ctx context.Context) (*acct, error) {
	var best *acct
	var bestFree int64

	for _, a := range s.accts {
		free := a.QuotaBytes - s.used(ctx, a.ID)
		if free <= 0 {
			continue
		}
		if best == nil || free > bestFree {
			best, bestFree = a, free
		}
	}

	if best == nil {
		return nil, ErrNoSpace
	}
	return best, nil
}

// used reads an account's running byte total, treating both a miss and an
// unreadable value as zero.
//
// Zero is the safe direction to be wrong in: it makes an account look emptier
// than it is, so the worst case is an upload sent to an account that rejects
// it, rather than a full account being hidden from a picture that then has
// nowhere to put anything.
//
// ponytail: one cache read per account per upload. Fine at a handful of
// accounts; switch to a single MGET if that ever grows.
func (s *Store) used(ctx context.Context, id string) int64 {
	b, err := s.c.Get(ctx, usedKeyPrefix+id)
	if err != nil {
		if !errors.Is(err, cache.ErrMiss) {
			log.Printf("storage: reading usage for imagekit account %q: %v", id, err)
		}
		return 0
	}

	n, err := strconv.ParseInt(string(b), 10, 64)
	if err != nil {
		log.Printf("storage: usage for imagekit account %q is not a number: %q", id, b)
		return 0
	}
	return n
}

// resolve splits a reference back into the account that holds the file and the
// three things the callers need from it.
func (s *Store) resolve(ref string) (a *acct, fileID string, size int64, path string, err error) {
	// SplitN with a limit of 4 so a separator inside the file path, unlikely
	// as that is, lands in the path rather than breaking the parse.
	parts := strings.SplitN(ref, refSep, 4)
	if len(parts) != 4 {
		return nil, "", 0, "", fmt.Errorf("%w: %q", ErrBadRef, ref)
	}

	a, ok := s.byID[parts[0]]
	if !ok {
		return nil, "", 0, "", fmt.Errorf("storage: reference %q names unknown imagekit account %q", ref, parts[0])
	}

	size, err = strconv.ParseInt(parts[2], 10, 64)
	if err != nil {
		return nil, "", 0, "", fmt.Errorf("%w: %q has a non-numeric size", ErrBadRef, ref)
	}

	return a, parts[1], size, parts[3], nil
}
