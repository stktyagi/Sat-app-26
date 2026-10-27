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
	ErrTeamLocked        = errors.New("team payment in progress or complete")
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
// isPerIndividual indicates whether the event prices per member (so joining an already-paid team
// leaves the new member unpaid and resets team.Paid to false) or as a flat team fee.
func (s *Store) JoinTeam(ctx context.Context, teamID, userID, regID string, reg *models.Registration, minSize, maxSize int, isPerIndividual bool) (*models.Team, error) {
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
		// Roster is frozen only while an active checkout is in progress with the gateway.
		locked, err := hasLiveCheckout(tx, s.FS.Collection(ColCheckouts).Doc(teamID))
		if err != nil {
			return err
		}
		if locked {
			return ErrTeamLocked
		}

		members := append(append([]string{}, team.MemberIDs...), userID)
		now := isotime.Now()

		teamUpdates := []firestore.Update{
			{Path: "memberIds", Value: members},
			{Path: "updatedAt", Value: now},
		}

		if minSize > 0 {
			teamUpdates = append(teamUpdates, firestore.Update{Path: "status", Value: models.StatusFor(len(members), minSize)})
		}

		if team.Paid {
			coveredByPriorPayment := !isPerIndividual || minSize <= 0 || len(members) <= minSize
			if coveredByPriorPayment {
				// Flat team fee or covered by leader's upfront payment for the team
				reg.PaymentStatus = models.RegPaymentSuccess
				reg.PaidAt = now
				if reg.PaymentDetails == nil {
					reg.PaymentDetails = map[string]any{}
				}
				reg.PaymentDetails["amount"] = 0
				reg.PaymentDetails["coveredByTeam"] = true
			} else {
				// Extra member beyond covered team size on a per-individual event
				teamUpdates = append(teamUpdates, firestore.Update{Path: "paid", Value: false})
				team.Paid = false
				reg.PaymentStatus = models.RegPaymentPending
			}
		}

		if err := tx.Update(teamRef, teamUpdates); err != nil {
			return err
		}
		if err := tx.Create(regRef, reg); err != nil {
			return wrap(err)
		}

		team.MemberIDs = members
		team.UpdatedAt = now
		if minSize > 0 {
			team.Status = models.StatusFor(len(members), minSize)
		}
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
		updates := []firestore.Update{
			{Path: "memberIds", Value: kept},
			{Path: "updatedAt", Value: isotime.Now()},
		}
		if minSize > 0 && len(kept) < minSize {
			updates = append(updates, firestore.Update{Path: "status", Value: models.TeamStatusPending})
		}

		if err := tx.Update(teamRef, updates); err != nil {
			return err
		}
		return tx.Delete(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(team.EventID, memberID)))
	})
}

// DeleteTeam removes the team and all registrations if the caller is the leader.
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
		if err := tx.Delete(teamRef); err != nil {
			return err
		}
		for _, mID := range team.MemberIDs {
			if err := tx.Delete(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(team.EventID, mID))); err != nil {
				return err
			}
		}
		return nil
	})
}

// ConfirmTeam marks the team as confirmed by the team leader.
func (s *Store) ConfirmTeam(ctx context.Context, teamID, leaderID string, markPaid bool) error {
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
		updates := []firestore.Update{
			{Path: "status", Value: models.TeamStatusConfirmed},
			{Path: "updatedAt", Value: isotime.Now()},
		}
		if markPaid {
			updates = append(updates, firestore.Update{Path: "paid", Value: true})
		}
		if err := tx.Update(teamRef, updates); err != nil {
			return err
		}

		if markPaid {
			for _, mID := range team.MemberIDs {
				regID := models.RegistrationID(team.EventID, mID)
				regRef := s.FS.Collection(ColRegistrations).Doc(regID)
				_ = tx.Update(regRef, []firestore.Update{
					{Path: "paymentStatus", Value: models.RegPaymentSuccess},
					{Path: "paidAt", Value: isotime.Now()},
				})
			}
		}
		return nil
	})
}

func (s *Store) UpdateTeam(ctx context.Context, teamID string, fields map[string]any) error {
	fields["updatedAt"] = isotime.Now()
	_, err := s.FS.Collection(ColTeams).Doc(teamID).Set(ctx, fields, firestore.MergeAll)
	return wrap(err)
}
