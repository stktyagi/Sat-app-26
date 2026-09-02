package models_test

import (
	"testing"

	"backend/internal/models"
)

// The document ID embeds the event, which is what makes invite codes unique
// within an event without a separate uniqueness check.
func TestTeamRef(t *testing.T) {
	if got := models.TeamRef("50-hour-film-making", "0275AA"); got != "50-hour-film-making_0275AA" {
		t.Errorf("TeamRef = %q", got)
	}
	// Codes are accepted in any case but always addressed in upper case.
	if got := models.TeamRef("e", "abc123"); got != "e_ABC123" {
		t.Errorf("invite codes should be upper-cased into the reference, got %q", got)
	}
}

func TestNewTeamSeatsTheLeader(t *testing.T) {
	team := models.NewTeam("sathack", "0275aa", "The Team", "u1", 3, nil)

	if team.TeamID != "sathack_0275AA" {
		t.Errorf("teamId should be the document ID, got %q", team.TeamID)
	}
	if team.InviteCode != "0275AA" {
		t.Errorf("the invite code should be stored upper-case, got %q", team.InviteCode)
	}
	if len(team.MemberIDs) != 1 || team.MemberIDs[0] != "u1" {
		t.Errorf("the leader should be the only member, got %v", team.MemberIDs)
	}
	if !team.IsLeader("u1") {
		t.Error("the creator should be the leader")
	}
	// One member against a minimum of three is not yet a confirmed team.
	if team.Status != models.TeamStatusPending {
		t.Errorf("status = %q, want pending", team.Status)
	}
	if team.Responses == nil {
		t.Error("responses should serialise as [] rather than null")
	}
}

// The team document stores member IDs only, so membership and removal are
// operations on that list.
func TestTeamMembership(t *testing.T) {
	team := &models.Team{LeaderUserID: "u1", MemberIDs: []string{"u1", "u2", "u3"}}

	if !team.HasMember("u2") {
		t.Error("u2 should be a member")
	}
	if team.HasMember("u9") {
		t.Error("u9 should not be a member")
	}
	if !team.IsLeader("u1") || team.IsLeader("u2") {
		t.Error("leadership is decided by leaderUserId alone")
	}

	kept := team.Without("u2")
	if len(kept) != 2 || kept[0] != "u1" || kept[1] != "u3" {
		t.Errorf("Without should drop only the named member and keep order, got %v", kept)
	}
	if len(team.MemberIDs) != 3 {
		t.Error("Without must not mutate the receiver: the transaction reads it again")
	}
	if got := team.Without("u9"); len(got) != 3 {
		t.Errorf("removing a non-member should change nothing, got %v", got)
	}
}

func TestStatusFor(t *testing.T) {
	if got := models.StatusFor(1, 3); got != models.TeamStatusPending {
		t.Errorf("a team below the minimum should be pending, got %q", got)
	}
	if got := models.StatusFor(3, 3); got != models.TeamStatusConfirmed {
		t.Errorf("a team at the minimum should be confirmed, got %q", got)
	}
	// Events with no minimum store zero.
	if got := models.StatusFor(1, 0); got != models.TeamStatusConfirmed {
		t.Errorf("no minimum should mean confirmed, got %q", got)
	}
}

func TestTeamNormaliseRecomputesSize(t *testing.T) {
	team := &models.Team{MemberIDs: []string{"u1", "u2"}}
	team.Normalise()
	if team.Size != 2 {
		t.Errorf("size = %d, want 2", team.Size)
	}

	empty := &models.Team{}
	empty.Normalise()
	if empty.Size != 0 || empty.MemberIDs == nil || empty.Responses == nil {
		t.Error("Normalise should leave empty collections serialisable as []")
	}
}
