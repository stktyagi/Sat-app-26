// Command migrate_ik moves users' profile photos and college IDs off one
// ImageKit account onto the accounts in IMAGEKIT_ACCOUNTS_FILE, then rewrites
// the user's photoRef/photoUrl and collegeIdRef/collegeIdUrl.
//
// Files are downloaded from the source's public URL, so the source account
// needs no key and does not have to be in imagekit.json. Nothing is deleted
// from the source: keep it until you've checked the app, then clean it up.
//
// Usage: go run ./cmd/migrate_ik   (set dryRun = false to actually migrate)
package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"path"
	"strings"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"backend/internal/cache"
	"backend/internal/config"
	"backend/internal/fb"
	"backend/internal/isotime"
	"backend/internal/storage"
	"backend/internal/store"
)

const (
	dryRun       = false
	fromID       = "sample"
	fromEndpoint = "https://ik.imagekit.io/sample"
)

// refField -> urlField on the user doc.
var fields = [][2]string{{"photoRef", "photoUrl"}, {"collegeIdRef", "collegeIdUrl"}}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	ctx := context.Background()

	clients, err := fb.New(ctx, cfg)
	if err != nil {
		log.Fatalf("firebase: %v", err)
	}
	defer clients.Close()

	provider, err := cache.NewRedis(ctx, cfg.RedisURL, cfg.RedisNamespace)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer provider.Close()

	files, err := storage.New(cfg.ImageKitAccountsFile, provider)
	if err != nil {
		log.Fatalf("storage: %v", err)
	}

	fmt.Printf("dryRun=%v  from=%s  usage before: %v\n\n", dryRun, fromID, files.Usage(ctx))

	var found, moved, failed int
	var bytes int64
	it := clients.FS.Collection(store.ColUsers).Select("photoRef", "collegeIdRef").Documents(ctx)
	defer it.Stop()
	for {
		doc, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Fatalf("listing users: %v", err)
		}

		for _, f := range fields {
			ref, _ := doc.Data()[f[0]].(string)
			// ref = accountID|fileID|size|filePath
			parts := strings.SplitN(ref, "|", 4)
			if len(parts) != 4 || parts[0] != fromID {
				continue
			}
			found++
			var size int64
			fmt.Sscan(parts[2], &size)
			bytes += size
			src := fromEndpoint + parts[3]

			if dryRun {
				fmt.Printf("[dry] %s %-12s %8d B  %s\n", doc.Ref.ID, f[0], size, src)
				continue
			}

			newRef, newURL, err := copyFile(ctx, files, src, path.Dir(parts[3]), doc.Ref.ID)
			if err != nil {
				failed++
				log.Printf("FAIL  %s %s: %v", doc.Ref.ID, f[0], err)
				continue
			}
			// Update, not Set: fails if the user was deleted mid-run instead of resurrecting a stub doc.
			if _, err := doc.Ref.Update(ctx, []firestore.Update{{Path: f[0], Value: newRef}, {Path: f[1], Value: newURL}, {Path: "updatedAt", Value: isotime.Now()}}); err != nil {
				failed++
				log.Printf("FAIL  %s %s: uploaded %s but db update failed: %v", doc.Ref.ID, f[0], newRef, err)
				_ = files.Delete(ctx, newRef)
				continue
			}
			moved++
			fmt.Printf("ok    %s %-12s -> %s\n", doc.Ref.ID, f[0], newURL)
		}
	}

	fmt.Printf("\nfound=%d (%.2f MB) moved=%d failed=%d\n", found, float64(bytes)/(1<<20), moved, failed)
	if !dryRun {
		fmt.Printf("usage after: %v\n", files.Usage(ctx))
	}
}

func copyFile(ctx context.Context, files *storage.Store, src, folder, name string) (string, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, src, nil)
	if err != nil {
		return "", "", err
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return "", "", fmt.Errorf("download %s: %s %s", src, res.Status, b)
	}
	return files.UploadFile(ctx, folder, name, res.Body)
}
