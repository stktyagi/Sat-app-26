package store

import (
	"context"
	"log"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"backend/internal/isotime"
	"backend/internal/models"
)

func (s *Store) GetUser(ctx context.Context, uid string) (*models.User, error) {
	doc, err := s.FS.Collection(ColUsers).Doc(uid).Get(ctx)
	if err != nil {
		return nil, wrap(err)
	}
	return decodeUser(doc)
}

// GetUserByEmail resolves a profile by its verified email address. The email is
// unique per account, so the first match is the only one; this is what lets an
// admin look someone up without knowing their user ID.
func (s *Store) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	q := s.FS.Collection(ColUsers).Where("email", "==", email).Limit(1)
	iter := q.Documents(ctx)
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

// GetUsers reads many users in one round trip. This is what replaces copying a
// profile snapshot onto every team and registration document: rosters hydrate
// from the source of truth instead of from a duplicate that can go stale.
// Missing users are simply absent from the result.
func (s *Store) GetUsers(ctx context.Context, ids []string) (map[string]*models.User, error) {
	out := make(map[string]*models.User, len(ids))
	if len(ids) == 0 {
		return out, nil
	}

	refs := make([]*firestore.DocumentRef, 0, len(ids))
	seen := make(map[string]bool, len(ids))
	for _, id := range ids {
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		refs = append(refs, s.FS.Collection(ColUsers).Doc(id))
	}

	snaps, err := s.FS.GetAll(ctx, refs)
	if err != nil {
		return nil, wrap(err)
	}
	for _, snap := range snaps {
		if !snap.Exists() {
			continue
		}
		u, err := decodeUser(snap)
		if err != nil {
			return nil, err
		}
		out[snap.Ref.ID] = u
	}
	return out, nil
}

// CreateUser writes the profile document at first sign-in. Create fails if one
// already exists, so a duplicate POST /auth/session cannot reset a profile.
func (s *Store) CreateUser(ctx context.Context, u *models.User) (*models.User, error) {
	if _, err := s.FS.Collection(ColUsers).Doc(u.UserID).Create(ctx, u); err != nil {
		return nil, wrap(err)
	}
	return s.GetUser(ctx, u.UserID)
}

func (s *Store) UpdateUser(ctx context.Context, uid string, fields map[string]any) (*models.User, error) {
	fields["updatedAt"] = isotime.Now()
	if _, err := s.FS.Collection(ColUsers).Doc(uid).Set(ctx, fields, firestore.MergeAll); err != nil {
		return nil, wrap(err)
	}
	return s.GetUser(ctx, uid)
}

// DeleteUser removes a user document and all associated registrations.
// This is an irreversible operation that should be used with caution.
func (s *Store) DeleteUser(ctx context.Context, uid string) error {
	// First delete all registrations for this user to avoid orphaned data
	regs, err := s.ListUserRegistrations(ctx, uid)
	if err != nil {
		return wrap(err)
	}
	for _, reg := range regs {
		if err := s.DeleteRegistration(ctx, reg.ID); err != nil {
			// Log but continue deleting other registrations
			log.Printf("failed to delete registration %s: %v", reg.ID, err)
		}
	}

	// Now delete the user document itself
	delRef := s.FS.Collection(ColUsers).Doc(uid)
	_, delErr := delRef.Delete(ctx)
	if delErr != nil {
		return wrap(delErr)
	}
	return nil
}
