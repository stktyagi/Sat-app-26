package store

import (
	"context"
	"sort"
	"time"

	"google.golang.org/api/iterator"

	"backend/internal/models"
)

// AllReels loads all reels, sorted by Order descending, then CreatedAt descending.
func (s *Store) AllReels(ctx context.Context) ([]*models.Reel, error) {
	iter := s.FS.Collection(ColReels).Documents(ctx)
	defer iter.Stop()

	out := []*models.Reel{}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, wrap(err)
		}
		r, err := decodeReel(doc)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}

	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Order != out[j].Order {
			return out[i].Order > out[j].Order
		}
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out, nil
}

func (s *Store) GetReel(ctx context.Context, id string) (*models.Reel, error) {
	doc, err := s.FS.Collection(ColReels).Doc(id).Get(ctx)
	if err != nil {
		return nil, wrap(err)
	}
	return decodeReel(doc)
}

func (s *Store) CreateReel(ctx context.Context, r *models.Reel) error {
	ref := s.FS.Collection(ColReels).NewDoc()
	r.ID = ref.ID
	now := time.Now().UTC()
	if r.CreatedAt.IsZero() {
		r.CreatedAt = now
	}
	r.UpdatedAt = now

	if _, err := ref.Create(ctx, r); err != nil {
		return wrap(err)
	}
	return nil
}

func (s *Store) SaveReel(ctx context.Context, r *models.Reel) error {
	r.UpdatedAt = time.Now().UTC()
	_, err := s.FS.Collection(ColReels).Doc(r.ID).Set(ctx, r)
	return wrap(err)
}

func (s *Store) DeleteReel(ctx context.Context, id string) error {
	_, err := s.FS.Collection(ColReels).Doc(id).Delete(ctx)
	return wrap(err)
}
