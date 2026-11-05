package store

import (
	"context"
	"errors"
	"sync"

	"cloud.google.com/go/firestore"
	"golang.org/x/sync/errgroup"
	"google.golang.org/api/iterator"

	"backend/internal/isotime"
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

// CountPaidRegistrations uses a server-side aggregation. For paid events, it counts
// only completed/paid registrations (paymentStatus == "success"). For free events,
// it counts all confirmed registrations normally.
func (s *Store) CountPaidRegistrations(ctx context.Context, eventID string) (int, error) {
	paidEvent := false
	if ev, err := s.GetEvent(ctx, eventID); err == nil && ev != nil {
		paidEvent = ev.PaymentRequired
	} else if err != nil && !errors.Is(err, ErrNotFound) {
		return 0, err
	}
	return s.countRegistrationsWithMode(ctx, eventID, paidEvent)
}

func (s *Store) countRegistrationsWithMode(ctx context.Context, eventID string, paymentRequired bool) (int, error) {
	q := s.FS.Collection(ColRegistrations).Where("eventId", "==", eventID)
	if paymentRequired {
		q = q.Where("paymentStatus", "==", models.RegPaymentSuccess)
	}
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

// CountAllRegistrations returns per-event totals of paid registrations. It uses
// concurrent aggregation queries rather than downloading the entire registrations
// collection, drastically reducing Firestore reads.
//
// Fix #2: the caller (cache.loadSource) already has the full events slice, so
// it passes a paidMap directly — eliminating the second AllEvents() Firestore
// call that used to happen here on every cache warm-up.
func (s *Store) CountAllRegistrations(ctx context.Context, eventIDs []string, paidMap map[string]bool) (map[string]int, error) {
	counts := make(map[string]int, len(eventIDs))
	var mu sync.Mutex
	g, gctx := errgroup.WithContext(ctx)

	for _, id := range eventIDs {
		id := id
		g.Go(func() error {
			n, err := s.countRegistrationsWithMode(gctx, id, paidMap[id])
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

// ListRegistrationsByTeam returns all registrations that belong to a specific team.
func (s *Store) ListRegistrationsByTeam(ctx context.Context, teamID string) ([]*models.Registration, error) {
	q := s.FS.Collection(ColRegistrations).Where("teamId", "==", teamID)
	return s.collectRegistrations(ctx, q)
}

// UpdateRegistrationCheckingStatus flips the on-site check-in state on a registration document.
func (s *Store) UpdateRegistrationCheckingStatus(ctx context.Context, id, status string) error {
	_, err := s.FS.Collection(ColRegistrations).Doc(id).Update(ctx, []firestore.Update{
		{Path: "checkingStatus", Value: status},
	})
	return wrap(err)
}

// UpdateRegistrationStatus updates the status field on a registration document.
func (s *Store) UpdateRegistrationStatus(ctx context.Context, id, status string) error {
	_, err := s.FS.Collection(ColRegistrations).Doc(id).Update(ctx, []firestore.Update{
		{Path: "status", Value: status},
	})
	return wrap(err)
}

// MarkRegistrationCovered marks a registration as successfully paid via team credit.
func (s *Store) MarkRegistrationCovered(ctx context.Context, id string) error {
	_, err := s.FS.Collection(ColRegistrations).Doc(id).Update(ctx, []firestore.Update{
		{Path: "paymentStatus", Value: models.RegPaymentSuccess},
		{Path: "paidAt", Value: isotime.Now()},
		{Path: "paymentDetails.amount", Value: 0},
		{Path: "paymentDetails.coveredByTeam", Value: true},
	})
	return wrap(err)
}
