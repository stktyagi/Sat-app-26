package store

import (
	"context"
	"errors"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"backend/internal/isotime"
	"backend/internal/models"
)

// Business-rule failures the team transactions can raise. Handlers map these
// onto HTTP status codes.
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
	return decodeTeam(doc)
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
		t, err := decodeTeam(doc)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, nil
}

// CreateTeamWithLeader writes the team document and the leader registration in
// one transaction, so a team can never exist without its leader being
// registered for the event.
func (s *Store) CreateTeamWithLeader(ctx context.Context, team *models.Team, regID string, reg *models.Registration) error {
	teamRef := s.FS.Collection(ColTeams).Doc(team.TeamID)
	regRef := s.FS.Collection(ColRegistrations).Doc(regID)

	return s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		if err := tx.Create(teamRef, team); err != nil {
			return err
		}
		return tx.Create(regRef, reg)
	})
}

// JoinTeam appends a member and creates their registration atomically. The
// capacity and duplicate checks run inside the transaction against the value
// actually read, so two people claiming the last slot cannot both succeed.
func (s *Store) JoinTeam(ctx context.Context, teamID, userID, regID string, reg *models.Registration, minSize, maxSize int) (*models.Team, error) {
	teamRef := s.FS.Collection(ColTeams).Doc(teamID)
	regRef := s.FS.Collection(ColRegistrations).Doc(regID)

	var updated *models.Team
	err := s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(teamRef)
		if err != nil {
			return wrap(err)
		}
		team, err := decodeTeam(snap)
		if err != nil {
			return err
		}
		if team.HasMember(userID) {
			return ErrAlreadyMember
		}
		if maxSize > 0 && len(team.MemberIDs) >= maxSize {
			return ErrTeamFull
		}

		members := append(append([]string{}, team.MemberIDs...), userID)
		status := models.StatusFor(len(members), minSize)
		now := isotime.Now()

		if err := tx.Update(teamRef, []firestore.Update{
			{Path: "memberIds", Value: members},
			{Path: "status", Value: status},
			{Path: "updatedAt", Value: now},
		}); err != nil {
			return err
		}
		if err := tx.Create(regRef, reg); err != nil {
			return wrap(err)
		}

		team.MemberIDs = members
		team.Status = status
		team.UpdatedAt = now
		team.Normalise()
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
func (s *Store) RemoveMember(ctx context.Context, teamID, memberID string, minSize int) error {
	teamRef := s.FS.Collection(ColTeams).Doc(teamID)

	return s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(teamRef)
		if err != nil {
			return wrap(err)
		}
		team, err := decodeTeam(snap)
		if err != nil {
			return err
		}
		if !team.HasMember(memberID) {
			return ErrNotMember
		}

		kept := team.Without(memberID)
		if err := tx.Update(teamRef, []firestore.Update{
			{Path: "memberIds", Value: kept},
			{Path: "status", Value: models.StatusFor(len(kept), minSize)},
			{Path: "updatedAt", Value: isotime.Now()},
		}); err != nil {
			return err
		}
		return tx.Delete(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(team.EventID, memberID)))
	})
}

// DeleteTeam removes the team and the leader registration, but only once the
// leader is the last member standing.
func (s *Store) DeleteTeam(ctx context.Context, teamID, leaderID string) error {
	teamRef := s.FS.Collection(ColTeams).Doc(teamID)

	return s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(teamRef)
		if err != nil {
			return wrap(err)
		}
		team, err := decodeTeam(snap)
		if err != nil {
			return err
		}
		if !team.IsLeader(leaderID) {
			return ErrNotLeader
		}
		if len(team.MemberIDs) > 1 {
			return ErrTeamNotEmpty
		}
		if err := tx.Delete(teamRef); err != nil {
			return err
		}
		return tx.Delete(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(team.EventID, leaderID)))
	})
}

func (s *Store) UpdateTeam(ctx context.Context, teamID string, fields map[string]any) error {
	fields["updatedAt"] = isotime.Now()
	_, err := s.FS.Collection(ColTeams).Doc(teamID).Set(ctx, fields, firestore.MergeAll)
	return wrap(err)
}
