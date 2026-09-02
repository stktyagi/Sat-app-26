package models

import (
	"fmt"
	"slices"
	"strings"

	"backend/internal/isotime"
)

const (
	TeamStatusPending   = "pending"
	TeamStatusConfirmed = "confirmed"
)

// TeamRef is the teamRegistrations document ID, "{eventId}_{INVITECODE}". The
// event is baked into the ID, so a Create is itself the guard that makes invite
// codes unique within an event. It is also the value team routes are addressed
// by, and the value stored on a registration as teamId.
func TeamRef(eventID, inviteCode string) string {
	return fmt.Sprintf("%s_%s", eventID, strings.ToUpper(inviteCode))
}

// Team holds member user IDs only. Event name and type are not copied here:
// they are read from the event cache via EventID, and a stored copy would go
// stale the moment an admin renames the event.
type Team struct {
	// TeamID is the document ID, which is TeamRef(EventID, InviteCode).
	TeamID       string     `json:"teamId" firestore:"-"`
	EventID      string     `json:"eventId"              firestore:"eventId"`
	TeamName     string     `json:"teamName"             firestore:"teamName"`
	LeaderUserID string     `json:"leaderUserId"         firestore:"leaderUserId"`
	InviteCode   string     `json:"inviteCode,omitempty" firestore:"inviteCode"`
	Status       string     `json:"status"               firestore:"status"`
	MemberIDs    []string   `json:"memberIds"            firestore:"memberIds"`
	Responses    []Response `json:"responses"            firestore:"responses"`
	CreatedAt    string     `json:"createdAt"            firestore:"createdAt"`
	UpdatedAt    string     `json:"updatedAt"            firestore:"updatedAt"`

	// Computed per response, never stored. Members is hydrated from the users
	// collection when a caller is entitled to see who else is on the team.
	Size    int             `json:"size"              firestore:"-"`
	Members []PublicProfile `json:"members,omitempty" firestore:"-"`
}

// NewTeam builds the document written when a leader opens a team.
func NewTeam(eventID, inviteCode, teamName, leaderID string, minTeamSize int, responses []Response) *Team {
	now := isotime.Now()
	if responses == nil {
		responses = []Response{}
	}
	return &Team{
		TeamID:       TeamRef(eventID, inviteCode),
		EventID:      eventID,
		TeamName:     teamName,
		LeaderUserID: leaderID,
		InviteCode:   strings.ToUpper(inviteCode),
		Status:       StatusFor(1, minTeamSize),
		MemberIDs:    []string{leaderID},
		Responses:    responses,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}

// Normalise fills the slice fields and recomputes Size.
func (t *Team) Normalise() {
	if t.MemberIDs == nil {
		t.MemberIDs = []string{}
	}
	if t.Responses == nil {
		t.Responses = []Response{}
	}
	t.Size = len(t.MemberIDs)
}

func (t *Team) HasMember(userID string) bool { return slices.Contains(t.MemberIDs, userID) }

func (t *Team) IsLeader(userID string) bool { return t.LeaderUserID == userID }

// Without returns the member list with one user removed, leaving the receiver
// untouched.
func (t *Team) Without(userID string) []string {
	kept := make([]string, 0, len(t.MemberIDs))
	for _, id := range t.MemberIDs {
		if id != userID {
			kept = append(kept, id)
		}
	}
	return kept
}

// StatusFor reports whether a team of this size has met the minimum the event
// requires.
func StatusFor(size, minTeamSize int) string {
	if minTeamSize > 0 && size < minTeamSize {
		return TeamStatusPending
	}
	return TeamStatusConfirmed
}
