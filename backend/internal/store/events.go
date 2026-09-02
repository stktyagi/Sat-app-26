package store

import (
	"context"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"backend/internal/isotime"
	"backend/internal/models"
)

func (s *Store) GetEvent(ctx context.Context, id string) (*models.Event, error) {
	doc, err := s.FS.Collection(ColEvents).Doc(id).Get(ctx)
	if err != nil {
		return nil, wrap(err)
	}
	return decodeEvent(doc)
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
		e, err := decodeEvent(doc)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, nil
}

// CreateEvent refuses to overwrite an existing slug.
func (s *Store) CreateEvent(ctx context.Context, e *models.Event) error {
	_, err := s.FS.Collection(ColEvents).Doc(e.EventID).Create(ctx, e)
	return wrap(err)
}

// SaveEvent overwrites the whole document. A PATCH reads the event, applies the
// supplied fields to it and writes the result back, so the document always
// matches the model exactly and no stale field can survive an edit.
func (s *Store) SaveEvent(ctx context.Context, e *models.Event) error {
	e.UpdatedAt = isotime.Now()
	_, err := s.FS.Collection(ColEvents).Doc(e.EventID).Set(ctx, e)
	return wrap(err)
}

// SetEventFields is the narrow path for a single-field write that must not
// depend on reading the document first.
func (s *Store) SetEventFields(ctx context.Context, id string, fields map[string]any) error {
	fields["updatedAt"] = isotime.Now()
	_, err := s.FS.Collection(ColEvents).Doc(id).Set(ctx, fields, firestore.MergeAll)
	return wrap(err)
}

func (s *Store) DeleteEvent(ctx context.Context, id string) error {
	_, err := s.FS.Collection(ColEvents).Doc(id).Delete(ctx)
	return wrap(err)
}
