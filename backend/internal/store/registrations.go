package store

import (
	"context"
	"sync"

	"cloud.google.com/go/firestore"
	"golang.org/x/sync/errgroup"
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

// CountAllRegistrations returns per-event totals. It uses concurrent
// aggregation queries rather than downloading the entire registrations
// collection, drastically reducing Firestore reads.
func (s *Store) CountAllRegistrations(ctx context.Context, eventIDs []string) (map[string]int, error) {
	counts := make(map[string]int, len(eventIDs))
	var mu sync.Mutex
	g, gctx := errgroup.WithContext(ctx)

	for _, id := range eventIDs {
		id := id
		g.Go(func() error {
			n, err := s.CountRegistrations(gctx, id)
			if err != nil {
				return err
			}
			mu.Lock()
			counts[id] = n
			mu.Unlock()
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
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
