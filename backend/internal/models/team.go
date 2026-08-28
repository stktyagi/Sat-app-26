package models

import (
	"fmt"
	"strings"
)

const (
	TeamStatusPending   = "pending"
	TeamStatusConfirmed = "confirmed"
)

// TeamRef is the teamRegistrations document ID, "{eventId}_{inviteCode}", which
// is how the existing data enforces per-event invite-code uniqueness. Team
// routes address this value directly.
func TeamRef(eventID, inviteCode string) string {
	return fmt.Sprintf("%s_%s", eventID, strings.ToUpper(inviteCode))
}

type TeamMember struct {
	UserID               string `json:"userId"`
	Name                 string `json:"name"`
	DisplayName          string `json:"displayName"`
	Email                string `json:"email"`
	PhoneNumber          string `json:"phoneNumber"`
	RollNumber           string `json:"rollNumber"`
	CollegeName          string `json:"collegeName"`
	PhotoURL             string `json:"photoURL"`
	IsHostCollegeStudent bool   `json:"isHostCollegeStudent"`
	JoinedAt             string `json:"joinedAt,omitempty"`
}

type Team struct {
	Ref          string       `json:"teamRef"`
	TeamID       string       `json:"teamId"`
	EventID      string       `json:"eventId"`
	EventName    string       `json:"eventName"`
	EventType    string       `json:"eventType"`
	TeamName     string       `json:"teamName"`
	LeaderUserID string       `json:"leaderUserId"`
	InviteCode   string       `json:"inviteCode,omitempty"`
	Status       string       `json:"status"`
	Members      []TeamMember `json:"members"`
	Responses    []Response   `json:"responses"`
	CreatedAt    string       `json:"createdAt"`
	UpdatedAt    string       `json:"updatedAt,omitempty"`
	Size         int          `json:"size"`
}

// TeamFromDoc reads both member shapes: the slim record this API writes, and
// the records from last year which embedded an entire user document per member.
func TeamFromDoc(ref string, m map[string]any) *Team {
	t := &Team{
		Ref:          ref,
		TeamID:       Str(m["teamId"]),
		EventID:      Str(m["eventId"]),
		EventName:    Str(m["eventName"]),
		EventType:    Str(m["eventType"]),
		TeamName:     Str(m["teamName"]),
		LeaderUserID: Str(m["leaderUserId"]),
		InviteCode:   Str(m["inviteCode"]),
		Status:       Str(m["status"]),
		CreatedAt:    Str(m["createdAt"]),
		UpdatedAt:    Str(m["updatedAt"]),
	}
	for _, mem := range MapSlice(m["members"]) {
		t.Members = append(t.Members, TeamMember{
			UserID:               Str(mem["userId"]),
			Name:                 Str(Coalesce(mem["name"], mem["displayName"])),
			DisplayName:          Str(Coalesce(mem["displayName"], mem["name"])),
			Email:                Str(mem["email"]),
			PhoneNumber:          Str(mem["phoneNumber"]),
			RollNumber:           Str(mem["rollNumber"]),
			CollegeName:          Str(mem["collegeName"]),
			PhotoURL:             Str(mem["photoURL"]),
			IsHostCollegeStudent: Bool(mem["isHostCollegeStudent"]),
			JoinedAt:             Str(mem["joinedAt"]),
		})
	}
	for _, resp := range MapSlice(m["responses"]) {
		t.Responses = append(t.Responses, Response{
			FieldID: Str(resp["fieldId"]),
			Label:   Str(resp["label"]),
			Type:    Str(resp["type"]),
			Value:   resp["value"],
		})
	}
	if t.Members == nil {
		t.Members = []TeamMember{}
	}
	if t.Responses == nil {
		t.Responses = []Response{}
	}
	t.Size = len(t.Members)
	return t
}

func (t *Team) HasMember(userID string) bool {
	for _, m := range t.Members {
		if m.UserID == userID {
			return true
		}
	}
	return false
}

func (t *Team) IsLeader(userID string) bool { return t.LeaderUserID == userID }

// StatusFor reports whether a team of this size has met the minimum the event
// requires.
func StatusFor(size, minTeamSize int) string {
	if minTeamSize > 0 && size < minTeamSize {
		return TeamStatusPending
	}
	return TeamStatusConfirmed
}
