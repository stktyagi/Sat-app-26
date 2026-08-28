package store

import (
	"context"
	"errors"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"backend/internal/models"
)

// Business-rule failures that the team transactions can raise. Handlers map
// these onto HTTP status codes.
var (
	ErrTeamFull          = errors.New("team is full")
	ErrAlreadyMember     = errors.New("already a member")
	ErrNotMember         = errors.New("not a member")
	ErrNotLeader         = errors.New("not the team leader")
	ErrTeamNotEmpty      = errors.New("team still has members")
	ErrLeaderCannotLeave = errors.New("leader cannot leave while members remain")
)

func (s *Store) GetTeam(ctx context.Context, ref string) (*models.Team, error) {
	doc, err := s.FS.Collection(ColTeams).Doc(ref).Get(ctx)
	if err != nil {
		return nil, wrap(err)
	}
	return models.TeamFromDoc(doc.Ref.ID, doc.Data()), nil
}

// FindTeamsByInviteCode resolves a bare invite code. Codes are unique within an
// event because the document ID embeds the event, but not across events, so
// this can legitimately return more than one team and the caller has to
// disambiguate with an event ID.
func (s *Store) FindTeamsByInviteCode(ctx context.Context, code string) ([]*models.Team, error) {
	iter := s.FS.Collection(ColTeams).Where("inviteCode", "==", code).Limit(5).Documents(ctx)
	defer iter.Stop()

	out := []*models.Team{}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, wrap(err)
		}
		out = append(out, models.TeamFromDoc(doc.Ref.ID, doc.Data()))
	}
	return out, nil
}

// CreateTeamWithLeader writes the team document and the leader registration in
// one transaction, so a team can never exist without its leader being
// registered for the event.
func (s *Store) CreateTeamWithLeader(ctx context.Context, teamRef string, teamDoc map[string]any, regID string, regDoc map[string]any) error {
	team := s.FS.Collection(ColTeams).Doc(teamRef)
	reg := s.FS.Collection(ColRegistrations).Doc(regID)

	return s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		if err := tx.Create(team, teamDoc); err != nil {
			return err
		}
		return tx.Create(reg, regDoc)
	})
}

// JoinTeam appends a member and creates their registration atomically. The
// capacity and duplicate checks run inside the transaction against the value
// actually read, so two people claiming the last slot cannot both succeed.
func (s *Store) JoinTeam(ctx context.Context, teamRef, userID string, member map[string]any, regID string, regDoc map[string]any, minSize, maxSize int) (*models.Team, error) {
	teamDoc := s.FS.Collection(ColTeams).Doc(teamRef)
	regRef := s.FS.Collection(ColRegistrations).Doc(regID)

	var updated *models.Team
	err := s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(teamDoc)
		if err != nil {
			return wrap(err)
		}
		team := models.TeamFromDoc(teamRef, snap.Data())
		if team.HasMember(userID) {
			return ErrAlreadyMember
		}
		if maxSize > 0 && len(team.Members) >= maxSize {
			return ErrTeamFull
		}

		raw := rawMembers(snap.Data())
		raw = append(raw, member)
		status := models.StatusFor(len(raw), minSize)

		if err := tx.Update(teamDoc, []firestore.Update{
			{Path: "members", Value: raw},
			{Path: "status", Value: status},
			{Path: "updatedAt", Value: models.NowString()},
		}); err != nil {
			return err
		}
		if err := tx.Create(regRef, regDoc); err != nil {
			return wrap(err)
		}

		team.Members = append(team.Members, models.TeamMember{})
		team.Status = status
		updated = team
		return nil
	})
	if err != nil {
		return nil, err
	}
	return updated, nil
}

// RemoveMember drops a member and deletes their registration. Used both by the
// leader removing someone and by a member leaving; the caller decides which
// permission check applies.
func (s *Store) RemoveMember(ctx context.Context, teamRef, memberID string, minSize int) error {
	teamDoc := s.FS.Collection(ColTeams).Doc(teamRef)

	return s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(teamDoc)
		if err != nil {
			return wrap(err)
		}
		team := models.TeamFromDoc(teamRef, snap.Data())
		if !team.HasMember(memberID) {
			return ErrNotMember
		}

		kept := make([]any, 0, len(team.Members))
		for _, raw := range rawMembers(snap.Data()) {
			m, ok := raw.(map[string]any)
			if !ok || models.Str(m["userId"]) != memberID {
				kept = append(kept, raw)
			}
		}

		if err := tx.Update(teamDoc, []firestore.Update{
			{Path: "members", Value: kept},
			{Path: "status", Value: models.StatusFor(len(kept), minSize)},
			{Path: "updatedAt", Value: models.NowString()},
		}); err != nil {
			return err
		}
		return tx.Delete(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(team.EventID, memberID)))
	})
}

// DeleteTeam removes the team and the leader registration, but only once the
// leader is the last member standing.
func (s *Store) DeleteTeam(ctx context.Context, teamRef, leaderID string) error {
	teamDoc := s.FS.Collection(ColTeams).Doc(teamRef)

	return s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(teamDoc)
		if err != nil {
			return wrap(err)
		}
		team := models.TeamFromDoc(teamRef, snap.Data())
		if !team.IsLeader(leaderID) {
			return ErrNotLeader
		}
		if len(team.Members) > 1 {
			return ErrTeamNotEmpty
		}
		if err := tx.Delete(teamDoc); err != nil {
			return err
		}
		return tx.Delete(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(team.EventID, leaderID)))
	})
}

func (s *Store) UpdateTeam(ctx context.Context, ref string, fields map[string]any) error {
	fields["updatedAt"] = models.NowString()
	_, err := s.FS.Collection(ColTeams).Doc(ref).Set(ctx, fields, firestore.MergeAll)
	return wrap(err)
}

// rawMembers returns the members array untouched so that legacy documents keep
// whatever extra fields they were written with when the array is rewritten.
func rawMembers(data map[string]any) []any {
	if arr, ok := data["members"].([]any); ok {
		return arr
	}
	return []any{}
}
