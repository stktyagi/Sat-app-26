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
// coveredByCredit indicates whether the total fee for the new team roster is already
// fully covered by payments previously settled for the team.
func (s *Store) JoinTeam(ctx context.Context, teamID, userID, regID string, reg *models.Registration, minSize, maxSize int, coveredByCredit bool) (*models.Team, error) {
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

		if coveredByCredit {
			reg.PaymentStatus = models.RegPaymentSuccess
			reg.PaidAt = now
			if reg.PaymentDetails == nil {
				reg.PaymentDetails = map[string]any{}
			}
			reg.PaymentDetails["amount"] = 0
			reg.PaymentDetails["coveredByTeam"] = true
			if !team.Paid {
				teamUpdates = append(teamUpdates, firestore.Update{Path: "paid", Value: true})
				team.Paid = true
			}
		} else {
			reg.PaymentStatus = models.RegPaymentPending
			if team.Paid {
				teamUpdates = append(teamUpdates, firestore.Update{Path: "paid", Value: false})
				team.Paid = false
			}
		}

		teamStatus := models.ResolveTeamStatus(len(members), minSize, team.Paid)
		teamUpdates = append(teamUpdates, firestore.Update{Path: "status", Value: teamStatus})
		reg.Status = teamStatus

		for _, mID := range team.MemberIDs {
			mRegID := models.RegistrationID(team.EventID, mID)
			mRegRef := s.FS.Collection(ColRegistrations).Doc(mRegID)
			mUpd := []firestore.Update{
				{Path: "status", Value: teamStatus},
			}
			if coveredByCredit {
				mUpd = append(mUpd,
					firestore.Update{Path: "paymentStatus", Value: models.RegPaymentSuccess},
					firestore.Update{Path: "paidAt", Value: now},
				)
			}
			_ = tx.Update(mRegRef, mUpd)
		}

		if err := tx.Update(teamRef, teamUpdates); err != nil {
			return err
		}
		if err := tx.Create(regRef, reg); err != nil {
			return wrap(err)
		}

		team.MemberIDs = members
		team.UpdatedAt = now
		team.Status = teamStatus
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
		newStatus := models.ResolveTeamStatus(len(kept), minSize, team.Paid)
		if newStatus != team.Status {
			updates = append(updates, firestore.Update{Path: "status", Value: newStatus})
			team.Status = newStatus
			for _, mID := range kept {
				mRegID := models.RegistrationID(team.EventID, mID)
				_ = tx.Update(s.FS.Collection(ColRegistrations).Doc(mRegID), []firestore.Update{
					{Path: "status", Value: newStatus},
				})
			}
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

// AdminDeleteTeam removes the team and all registrations without leader verification.
func (s *Store) AdminDeleteTeam(ctx context.Context, teamID string) error {
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

		for _, mID := range team.MemberIDs {
			regID := models.RegistrationID(team.EventID, mID)
			regRef := s.FS.Collection(ColRegistrations).Doc(regID)
			regUpdates := []firestore.Update{
				{Path: "status", Value: models.RegStatusConfirmed},
			}
			if markPaid {
				regUpdates = append(regUpdates,
					firestore.Update{Path: "paymentStatus", Value: models.RegPaymentSuccess},
					firestore.Update{Path: "paidAt", Value: isotime.Now()},
				)
			}
			_ = tx.Update(regRef, regUpdates)
		}
		return nil
	})
}

func (s *Store) UpdateTeam(ctx context.Context, teamID string, fields map[string]any) error {
	fields["updatedAt"] = isotime.Now()
	_, err := s.FS.Collection(ColTeams).Doc(teamID).Set(ctx, fields, firestore.MergeAll)
	return wrap(err)
}

// MarkTeamPaid flips the paid flag on a team document to true.
func (s *Store) MarkTeamPaid(ctx context.Context, teamID string) error {
	_, err := s.FS.Collection(ColTeams).Doc(teamID).Update(ctx, []firestore.Update{
		{Path: "paid", Value: true},
		{Path: "updatedAt", Value: isotime.Now()},
	})
	return wrap(err)
}

// CleanUserFromTeam cleans up a user's presence from a team when their account is deleted.
// - If the user was the only member, the team document is deleted.
// - If the user was the leader and other members remain, leadership is handed over to the next member.
// - If the event specifies minTeamSize and the remaining member count drops below it, status becomes pending.
func (s *Store) CleanUserFromTeam(ctx context.Context, teamID, userID string) error {
	teamRef := s.FS.Collection(ColTeams).Doc(teamID)

	return s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(teamRef)
		if err != nil {
			if errors.Is(wrap(err), ErrNotFound) {
				return nil
			}
			return wrap(err)
		}
		team, err := decodeTeam(snap)
		if err != nil {
			return err
		}

		if !team.HasMember(userID) && !team.IsLeader(userID) {
			return nil
		}

		kept := team.Without(userID)
		if len(kept) == 0 {
			// No remaining members — delete the team document to avoid orphans
			return tx.Delete(teamRef)
		}

		// Read event within transaction read phase to determine minTeamSize
		var minSize int
		if team.EventID != "" {
			evDoc, evErr := tx.Get(s.FS.Collection(ColEvents).Doc(team.EventID))
			if evErr == nil {
				if ev, err := decodeEvent(evDoc); err == nil && ev != nil {
					minSize = ev.MinTeamSize
				}
			}
		}

		updates := []firestore.Update{
			{Path: "memberIds", Value: kept},
			{Path: "updatedAt", Value: isotime.Now()},
		}

		// If the user was the leader, handover leadership to the next person
		if team.IsLeader(userID) {
			updates = append(updates, firestore.Update{Path: "leaderUserId", Value: kept[0]})
		}

		newStatus := models.ResolveTeamStatus(len(kept), minSize, team.Paid)
		if newStatus != team.Status {
			updates = append(updates, firestore.Update{Path: "status", Value: newStatus})
			for _, mID := range kept {
				mRegID := models.RegistrationID(team.EventID, mID)
				_ = tx.Update(s.FS.Collection(ColRegistrations).Doc(mRegID), []firestore.Update{
					{Path: "status", Value: newStatus},
				})
			}
		}

		return tx.Update(teamRef, updates)
	})
}
