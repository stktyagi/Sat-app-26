package store

import (
	"context"

	"cloud.google.com/go/firestore"

	"backend/internal/models"
)

func (s *Store) GetUser(ctx context.Context, uid string) (*models.User, error) {
	doc, err := s.FS.Collection(ColUsers).Doc(uid).Get(ctx)
	if err != nil {
		return nil, wrap(err)
	}
	return models.UserFromDoc(doc.Ref.ID, doc.Data()), nil
}

// CreateUser writes a new user document shaped exactly like the existing ones,
// including the day-keyed accommodation, food and checkInStatus maps that other
// parts of the platform expect to be present, and the ten-coin signup bonus
// every sampled account carries.
func (s *Store) CreateUser(ctx context.Context, uid string, seed map[string]any) (*models.User, error) {
	now := models.NowString()
	days := map[string]any{"day00": false, "day0": false, "day1": false, "day2": false, "day3": false, "day4": false}

	doc := map[string]any{
		"userId":               uid,
		"role":                 models.RoleUser,
		"fullyRegistered":      false,
		"isVerified":           false,
		"isAmbassador":         false,
		"accommodationNeeded":  false,
		"isHostCollegeStudent": false,
		"displayName":          "",
		"phoneNumber":          "",
		"rollNumber":           "",
		"collegeName":          "",
		"gender":               "",
		"age":                  "",
		"graduationYear":       "",
		"interests":            []any{},
		"referredBy":           "",
		"coins":                10,
		"coinsHistory": []any{map[string]any{
			"type": "signup", "coins": 10, "message": "Signup bonus", "date": now,
		}},
		"accommodation": days,
		"food":          copyMap(days),
		"checkInStatus": map[string]any{"fest": false, "accommodation": false, "Hostel": nil},
		"createdAt":     now,
		"updatedAt":     firestore.ServerTimestamp,
	}
	for k, v := range seed {
		doc[k] = v
	}

	if _, err := s.FS.Collection(ColUsers).Doc(uid).Set(ctx, doc); err != nil {
		return nil, wrap(err)
	}
	return s.GetUser(ctx, uid)
}

// UpdateUser merges fields and always refreshes updatedAt. This collection
// stores updatedAt as a real Timestamp, unlike events and registrations which
// use ISO strings.
func (s *Store) UpdateUser(ctx context.Context, uid string, fields map[string]any) (*models.User, error) {
	fields["updatedAt"] = firestore.ServerTimestamp
	if _, err := s.FS.Collection(ColUsers).Doc(uid).Set(ctx, fields, firestore.MergeAll); err != nil {
		return nil, wrap(err)
	}
	return s.GetUser(ctx, uid)
}

func copyMap(m map[string]any) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}
