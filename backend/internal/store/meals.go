package store

import (
	"context"
	"errors"
	"sort"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"backend/internal/models"
)

const ColMealLogs = "mealLogs"

var ErrMealAvailed = errors.New("meal already availed for this slot")

// LogMeal records an availed meal. Each meal availed is logged as an independent record
// allowing participants to avail meals as many times as needed while preserving an audit log.
func (s *Store) LogMeal(ctx context.Context, l *models.MealLog) error {
	_, _, err := s.FS.Collection(ColMealLogs).Add(ctx, l)
	return wrap(err)
}

// ListMealLogs returns logs for a day, optionally narrowed to one slot, oldest first.
func (s *Store) ListMealLogs(ctx context.Context, day, slot string) ([]*models.MealLog, error) {
	q := s.FS.Collection(ColMealLogs).Query
	if day != "" {
		q = q.Where("day", "==", day)
	}
	if slot != "" {
		q = q.Where("slot", "==", slot)
	}
	iter := q.Documents(ctx)
	defer iter.Stop()
	out := []*models.MealLog{}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, wrap(err)
		}
		var l models.MealLog
		if err := doc.DataTo(&l); err != nil {
			return nil, err
		}
		out = append(out, &l)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].At < out[j].At })
	return out, nil
}

// GetUserByMealCode resolves the user a typed meal code belongs to.
func (s *Store) GetUserByMealCode(ctx context.Context, code string) (*models.User, error) {
	iter := s.FS.Collection(ColUsers).Where("mealCode", "==", code).Limit(1).Documents(ctx)
	defer iter.Stop()
	doc, err := iter.Next()
	if err == iterator.Done {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, wrap(err)
	}
	return decodeUser(doc)
}

// SetMealCode stores the user's derived meal code so it can be looked up.
func (s *Store) SetMealCode(ctx context.Context, uid, code string) error {
	_, err := s.FS.Collection(ColUsers).Doc(uid).Update(ctx, []firestore.Update{{Path: "mealCode", Value: code}})
	evictUserFromCache(uid)
	return wrap(err)
}
