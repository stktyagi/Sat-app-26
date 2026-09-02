package store

import (
	"context"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"backend/internal/models"
)

func (s *Store) GetRegistration(ctx context.Context, id string) (*models.Registration, error) {
	doc, err := s.FS.Collection(ColRegistrations).Doc(id).Get(ctx)
	if err != nil {
		return nil, wrap(err)
	}
	return decodeRegistration(doc)
}

// CreateRegistration relies on the deterministic document ID for uniqueness.
// Create fails if the document already exists, so a duplicate registration is
// rejected atomically by Firestore rather than by a read-then-write check that
// two concurrent requests could both pass.
func (s *Store) CreateRegistration(ctx context.Context, id string, reg *models.Registration) error {
	_, err := s.FS.Collection(ColRegistrations).Doc(id).Create(ctx, reg)
	return wrap(err)
}

func (s *Store) DeleteRegistration(ctx context.Context, id string) error {
	_, err := s.FS.Collection(ColRegistrations).Doc(id).Delete(ctx)
	return wrap(err)
}

// CountRegistrations uses a server-side aggregation, so capacity checks do not
// stream documents back. This is what lets the schema stay free of a
// registeredCount field that could drift.
func (s *Store) CountRegistrations(ctx context.Context, eventID string) (int, error) {
	q := s.FS.Collection(ColRegistrations).Where("eventId", "==", eventID)
	res, err := q.NewAggregationQuery().WithCount("n").Get(ctx)
	if err != nil {
		return 0, wrap(err)
	}
	v, ok := res["n"]
	if !ok {
		return 0, nil
	}
	return int(decodeAggValue(v)), nil
}

// CountAllRegistrations returns per-event totals in a single pass, which is how
// the cache populates counts for the whole event list at once.
func (s *Store) CountAllRegistrations(ctx context.Context) (map[string]int, error) {
	iter := s.FS.Collection(ColRegistrations).Select("eventId").Documents(ctx)
	defer iter.Stop()

	counts := map[string]int{}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, wrap(err)
		}
		if id, ok := doc.Data()["eventId"].(string); ok {
			counts[id]++
		}
	}
	return counts, nil
}

func (s *Store) ListUserRegistrations(ctx context.Context, uid string) ([]*models.Registration, error) {
	q := s.FS.Collection(ColRegistrations).
		Where("userId", "==", uid).
		OrderBy("registeredAt", firestore.Desc)
	return s.collectRegistrations(ctx, q)
}

func (s *Store) ListEventRegistrations(ctx context.Context, eventID string, limit, offset int) ([]*models.Registration, error) {
	q := s.FS.Collection(ColRegistrations).Where("eventId", "==", eventID).Offset(offset).Limit(limit)
	return s.collectRegistrations(ctx, q)
}

func (s *Store) collectRegistrations(ctx context.Context, q firestore.Query) ([]*models.Registration, error) {
	iter := q.Documents(ctx)
	defer iter.Stop()

	out := []*models.Registration{}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, wrap(err)
		}
		r, err := decodeRegistration(doc)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, nil
}
