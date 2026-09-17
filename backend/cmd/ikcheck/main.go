// Command ikcheck does one real round trip against the configured ImageKit
// accounts: upload, sign, fetch, delete.
//
// The unit tests cover everything that can be checked offline, but they cannot
// prove that the upload call is shaped right or that a signature ImageKit
// accepts is being produced. This can. A wrong signature fails closed — the
// fetch comes back 401 — so this passing is real evidence rather than an
// absence of complaints.
//
// Usage: go run ./cmd/ikcheck   (needs IMAGEKIT_ACCOUNTS_FILE and REDIS_URL)
package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"backend/internal/cache"
	"backend/internal/config"
	"backend/internal/storage"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	if cfg.ImageKitAccountsFile == "" {
		log.Fatal("IMAGEKIT_ACCOUNTS_FILE is not set, so there is nothing to check")
	}

	ctx := context.Background()
	provider, err := cache.NewRedis(ctx, cfg.RedisURL, cfg.RedisNamespace)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer provider.Close()

	files, err := storage.New(cfg.ImageKitAccountsFile, provider)
	if err != nil {
		log.Fatalf("storage: %v", err)
	}

	before := files.Usage(ctx)
	fmt.Printf("usage before: %v\n", before)

	// A tiny, obviously disposable payload, named so anything left behind by a
	// crashed run is recognisable in the ImageKit dashboard.
	payload := []byte("ikcheck " + time.Now().UTC().Format(time.RFC3339) + "\n")
	ref, err := files.Upload(ctx, "ikcheck", "ikcheck.txt", bytes.NewReader(payload))
	if err != nil {
		log.Fatalf("upload: %v", err)
	}
	fmt.Printf("uploaded:     %s\n", ref)

	after := files.Usage(ctx)
	fmt.Printf("usage after:  %v\n", after)
	for id, n := range after {
		if d := n - before[id]; d != 0 {
			fmt.Printf("counted:      %+d bytes onto %s (payload is %d bytes)\n", d, id, len(payload))
		}
	}

	signed, err := files.SignedURL(ref, 5*time.Minute)
	if err != nil {
		log.Fatalf("signing: %v", err)
	}
	fmt.Printf("signed url:   %s\n", signed)

	// The point of the whole exercise: does ImageKit accept our signature?
	if err := fetch(ctx, signed, payload); err != nil {
		log.Fatalf("fetching the signed url: %v", err)
	}
	fmt.Println("fetched:      200, body matches what was uploaded")

	if err := files.Delete(ctx, ref); err != nil {
		log.Fatalf("delete: %v", err)
	}
	fmt.Printf("deleted:      ok\n")
	fmt.Printf("usage final:  %v\n", files.Usage(ctx))
}

func fetch(ctx context.Context, url string, want []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return err
	}
	if res.StatusCode != http.StatusOK {
		// 401 here means the signature was rejected, which is the failure this
		// whole command exists to catch.
		return fmt.Errorf("got %s: %s", res.Status, bytes.TrimSpace(body))
	}
	if !bytes.Equal(body, want) {
		return fmt.Errorf("body is %q, expected %q", body, want)
	}
	return nil
}
