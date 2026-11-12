package store

import (
	"context"
	"log"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"backend/internal/isotime"
	"backend/internal/models"
)

// ---------------------------------------------------------------------------
// Fix #1: in-process user cache
//
// Every authenticated request used to do one Firestore read per call to
// GetUser. A 3-minute TTL keeps the data fresh enough for all practical
// purposes; write operations (UpdateUser, CreateUser) invalidate the entry
// immediately so callers never see truly stale data after a mutation.
// ---------------------------------------------------------------------------

const userCacheTTL = 3 * time.Minute

type userCacheEntry struct {
	user      *models.User
	expiresAt time.Time
}

var (
	userCacheMu sync.RWMutex
	userCache   = map[string]userCacheEntry{}
)

func getUserFromCache(uid string) (*models.User, bool) {
	userCacheMu.RLock()
	e, ok := userCache[uid]
	userCacheMu.RUnlock()
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.user, true
}

func setUserInCache(u *models.User) {
	userCacheMu.Lock()
	userCache[u.UserID] = userCacheEntry{user: u, expiresAt: time.Now().Add(userCacheTTL)}
	userCacheMu.Unlock()
}

func evictUserFromCache(uid string) {
	userCacheMu.Lock()
	delete(userCache, uid)
	userCacheMu.Unlock()
}

func (s *Store) GetUser(ctx context.Context, uid string) (*models.User, error) {
	if u, ok := getUserFromCache(uid); ok {
		return u, nil
	}
	doc, err := s.FS.Collection(ColUsers).Doc(uid).Get(ctx)
	if err != nil {
		return nil, wrap(err)
	}
	u, err := decodeUser(doc)
	if err != nil {
		return nil, err
	}
	setUserInCache(u)
	return u, nil
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
	u, err := decodeUser(doc)
	if err != nil {
		return nil, err
	}
	setUserInCache(u)
	return u, nil
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
		// Serve from cache when possible; only build refs for misses.
		if u, ok := getUserFromCache(id); ok {
			out[id] = u
			continue
		}
		refs = append(refs, s.FS.Collection(ColUsers).Doc(id))
	}

	if len(refs) > 0 {
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
			setUserInCache(u)
			out[snap.Ref.ID] = u
		}
	}
	return out, nil
}

// CreateUser writes the profile document at first sign-in. Create fails if one
// already exists, so a duplicate POST /auth/session cannot reset a profile.
func (s *Store) CreateUser(ctx context.Context, u *models.User) (*models.User, error) {
	if _, err := s.FS.Collection(ColUsers).Doc(u.UserID).Create(ctx, u); err != nil {
		return nil, wrap(err)
	}
	// Seed the cache immediately so the caller gets a consistent view without
	// an extra Firestore read.
	setUserInCache(u)
	return u, nil
}

func (s *Store) UpdateUser(ctx context.Context, uid string, fields map[string]any) (*models.User, error) {
	fields["updatedAt"] = isotime.Now()
	if _, err := s.FS.Collection(ColUsers).Doc(uid).Set(ctx, fields, firestore.MergeAll); err != nil {
		return nil, wrap(err)
	}
	// Evict so the next read fetches the authoritative document from Firestore
	// and re-populates the cache with the full merged result.
	evictUserFromCache(uid)
	return s.GetUser(ctx, uid)
}

// DeleteUser removes a user document, associated registrations, and cleans up team memberships
// (handing over leadership to the next member or disbanding empty teams).
// This is an irreversible operation that should be used with caution.
func (s *Store) DeleteUser(ctx context.Context, uid string) error {
	// 1. First list all registrations for this user to avoid orphaned data
	regs, err := s.ListUserRegistrations(ctx, uid)
	if err != nil {
		return wrap(err)
	}

	// 2. Discover any teams associated with this user
	teamIDs := make(map[string]struct{})
	for _, reg := range regs {
		if reg.TeamID != "" {
			teamIDs[reg.TeamID] = struct{}{}
		}
	}

	// Also find teams where the user is listed directly as leader or member
	if leaderDocs, err := s.FS.Collection(ColTeams).Where("leaderUserId", "==", uid).Documents(ctx).GetAll(); err == nil {
		for _, doc := range leaderDocs {
			teamIDs[doc.Ref.ID] = struct{}{}
		}
	}
	if memberDocs, err := s.FS.Collection(ColTeams).Where("memberIds", "array-contains", uid).Documents(ctx).GetAll(); err == nil {
		for _, doc := range memberDocs {
			teamIDs[doc.Ref.ID] = struct{}{}
		}
	}

	// 3. Clean up user from each team (handover leadership to the next person or delete empty team)
	for teamID := range teamIDs {
		if err := s.CleanUserFromTeam(ctx, teamID, uid); err != nil {
			log.Printf("failed to clean user %s from team %s: %v", uid, teamID, err)
		}
	}

	// 4. Delete all user event registrations
	for _, reg := range regs {
		if err := s.DeleteRegistration(ctx, reg.ID); err != nil {
			// Log but continue deleting other registrations
			log.Printf("failed to delete registration %s: %v", reg.ID, err)
		}
	}

	// 5. Delete the user document itself
	delRef := s.FS.Collection(ColUsers).Doc(uid)
	_, delErr := delRef.Delete(ctx)
	if delErr != nil {
		return wrap(delErr)
	}

	// 6. Evict from memory caches
	evictUserFromCache(uid)
	s.InvalidateAccommodationCache()
	return nil
}

// UpdateUserAccommodation saves the updated accommodation choices for a user.
func (s *Store) UpdateUserAccommodation(ctx context.Context, userID string, needed bool, acc map[string]bool, food map[string]bool, txIDs []string) error {
	// Invariant: food is strictly an add-on to accommodation for each day
	for day, hasFood := range food {
		if hasFood && (acc == nil || !acc[day]) {
			delete(food, day)
		}
	}
	updates := []firestore.Update{
		{Path: "accommodationNeeded", Value: needed},
		{Path: "accommodation", Value: acc},
		{Path: "food", Value: food},
		{Path: "accommodationTransactionIds", Value: txIDs},
		{Path: "updatedAt", Value: isotime.Now()},
	}
	_, err := s.FS.Collection(ColUsers).Doc(userID).Update(ctx, updates)
	if err == nil {
		evictUserFromCache(userID)
	}
	return wrap(err)
}

var (
	accomMu        sync.RWMutex
	accomCache     []*models.User
	accomCacheTime time.Time
	// Bumped from 60s to 10 minutes — admin dashboard open in a tab
	// was draining reads every minute.
	accomTTL = 10 * time.Minute
)

// InvalidateAccommodationCache clears the cached accommodation users slice.
func (s *Store) InvalidateAccommodationCache() {
	accomMu.Lock()
	accomCache = nil
	accomMu.Unlock()
}

// ListAccommodationUsers returns users who have booked accommodation days,
// cached with a 10-minute TTL.
func (s *Store) ListAccommodationUsers(ctx context.Context) ([]*models.User, error) {
	accomMu.RLock()
	if accomCache != nil && time.Since(accomCacheTime) < accomTTL {
		cached := accomCache
		accomMu.RUnlock()
		return cached, nil
	}
	accomMu.RUnlock()

	accomMu.Lock()
	defer accomMu.Unlock()

	// Double check under write lock
	if accomCache != nil && time.Since(accomCacheTime) < accomTTL {
		return accomCache, nil
	}

	// Query Firestore using an OR filter across all accommodation days.
	// This only reads users who actually have an accommodation day booked,
	// rather than scanning all users or pulling users who only checked accommodationNeeded.
	iter := s.FS.Collection(ColUsers).WhereEntity(firestore.OrFilter{
		Filters: []firestore.EntityFilter{
			firestore.PropertyFilter{Path: "accommodation.day0", Operator: "==", Value: true},
			firestore.PropertyFilter{Path: "accommodation.day1", Operator: "==", Value: true},
			firestore.PropertyFilter{Path: "accommodation.day2", Operator: "==", Value: true},
			firestore.PropertyFilter{Path: "accommodation.day3", Operator: "==", Value: true},
			firestore.PropertyFilter{Path: "accommodation.day4", Operator: "==", Value: true},
		},
	}).Documents(ctx)
	defer iter.Stop()

	var users []*models.User
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, wrap(err)
		}
		u, err := decodeUser(doc)
		if err != nil {
			continue
		}
		hasAcc := false
		for _, v := range u.Accommodation {
			if v {
				hasAcc = true
				break
			}
		}
		if hasAcc {
			users = append(users, u)
		}
	}

	accomCache = users
	accomCacheTime = time.Now()
	return users, nil
}
