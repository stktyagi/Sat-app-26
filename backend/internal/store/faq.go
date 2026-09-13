package store

import (
	"context"
	"sort"

	"google.golang.org/api/iterator"

	"backend/internal/models"
)

// AllFaqs loads the whole collection sorted by order. Sorting happens in Go so
// a document missing the order field is not silently dropped by an OrderBy.
func (s *Store) AllFaqs(ctx context.Context) ([]*models.Faq, error) {
	iter := s.FS.Collection(ColFaqs).Documents(ctx)
	defer iter.Stop()

	out := []*models.Faq{}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, wrap(err)
		}
		f, err := decodeFaq(doc)
		if err != nil {
			return nil, err
		}
		out = append(out, f)
	}

	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Order != out[j].Order {
			return out[i].Order < out[j].Order
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

func (s *Store) GetFaq(ctx context.Context, id string) (*models.Faq, error) {
	doc, err := s.FS.Collection(ColFaqs).Doc(id).Get(ctx)
	if err != nil {
		return nil, wrap(err)
	}
	return decodeFaq(doc)
}

// CreateFaq writes under a Firestore auto-ID and stamps it onto f.
func (s *Store) CreateFaq(ctx context.Context, f *models.Faq) error {
	ref := s.FS.Collection(ColFaqs).NewDoc()
	if _, err := ref.Create(ctx, f); err != nil {
		return wrap(err)
	}
	f.ID = ref.ID
	return nil
}

// SaveFaq overwrites the whole document, same as SaveEvent.
func (s *Store) SaveFaq(ctx context.Context, f *models.Faq) error {
	_, err := s.FS.Collection(ColFaqs).Doc(f.ID).Set(ctx, f)
	return wrap(err)
}

func (s *Store) DeleteFaq(ctx context.Context, id string) error {
	_, err := s.FS.Collection(ColFaqs).Doc(id).Delete(ctx)
	return wrap(err)
}
