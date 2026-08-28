package store

import (
	"context"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"backend/internal/models"
)

func (s *Store) GetEvent(ctx context.Context, id string) (*models.Event, error) {
	doc, err := s.FS.Collection(ColEvents).Doc(id).Get(ctx)
	if err != nil {
		return nil, wrap(err)
	}
	return models.EventFromDoc(doc.Ref.ID, doc.Data()), nil
}

// AllEvents loads the whole collection. There are fewer than a hundred events
// in a fest, and the result is held in the cache layer, so this runs once per
// TTL rather than once per request.
func (s *Store) AllEvents(ctx context.Context) ([]*models.Event, error) {
	iter := s.FS.Collection(ColEvents).Documents(ctx)
	defer iter.Stop()

	var out []*models.Event
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, wrap(err)
		}
		out = append(out, models.EventFromDoc(doc.Ref.ID, doc.Data()))
	}
	return out, nil
}

// CreateEvent refuses to overwrite an existing slug.
func (s *Store) CreateEvent(ctx context.Context, id string, doc map[string]any) error {
	_, err := s.FS.Collection(ColEvents).Doc(id).Create(ctx, doc)
	return wrap(err)
}

func (s *Store) UpdateEvent(ctx context.Context, id string, fields map[string]any) error {
	fields["updatedAt"] = models.NowString()
	_, err := s.FS.Collection(ColEvents).Doc(id).Set(ctx, fields, firestore.MergeAll)
	return wrap(err)
}

func (s *Store) DeleteEvent(ctx context.Context, id string) error {
	_, err := s.FS.Collection(ColEvents).Doc(id).Delete(ctx)
	return wrap(err)
}
