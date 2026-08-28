package models

import "fmt"

// Registration statuses, using the vocabulary already present in the live data.
const (
	RegStatusConfirmed      = "confirmed"
	RegStatusPending        = "pending"
	RegStatusAwaited        = "awaited"
	RegStatusPaymentPending = "payment_pending"

	CheckinPending = "pending"
)

// RegistrationID is the document ID convention the existing data already uses:
// "3d-printing-workshop_0NxY025770W9cPpzHUtTPoulNVJ3". Because it is derived
// from the pair, a create with a "must not exist" precondition is itself the
// double-registration guard — no read-then-write race.
func RegistrationID(eventID, userID string) string {
	return fmt.Sprintf("%s_%s", eventID, userID)
}

type Response struct {
	FieldID string `json:"fieldId"`
	Label   string `json:"label"`
	Type    string `json:"type"`
	Value   any    `json:"value"`
}

type Registration struct {
	ID             string         `json:"registrationId"`
	UserID         string         `json:"userId"`
	EventID        string         `json:"eventId"`
	TeamID         string         `json:"teamId,omitempty"`
	TeamInviteCode string         `json:"teamInviteCode,omitempty"`
	Status         string         `json:"status"`
	CheckingStatus string         `json:"checkingStatus"`
	PaymentStatus  string         `json:"paymentStatus"`
	User           map[string]any `json:"user"`
	PaymentDetails map[string]any `json:"paymentDetails"`
	Responses      []Response     `json:"responses"`
	RegisteredAt   string         `json:"registeredAt"`
	PaidAt         string         `json:"paidAt,omitempty"`
	EventName      string         `json:"eventName"`
	EventType      string         `json:"eventType"`
	EventCategory  string         `json:"eventCategory"`

	// Computed per response, never stored.
	QRToken string `json:"qrToken,omitempty"`
}

func RegistrationFromDoc(id string, m map[string]any) *Registration {
	r := &Registration{
		ID:             id,
		UserID:         Str(m["userId"]),
		EventID:        Str(m["eventId"]),
		TeamID:         Str(m["teamId"]),
		TeamInviteCode: Str(m["teamInviteCode"]),
		Status:         Str(m["status"]),
		CheckingStatus: Str(m["checkingStatus"]),
		PaymentStatus:  Str(m["paymentStatus"]),
		User:           Map(m["user"]),
		PaymentDetails: Map(m["paymentDetails"]),
		RegisteredAt:   Str(m["registeredAt"]),
		PaidAt:         Str(m["paidAt"]),
		EventName:      Str(m["eventName"]),
		EventType:      Str(m["eventType"]),
		EventCategory:  Str(m["eventCategory"]),
	}
	for _, resp := range MapSlice(m["responses"]) {
		r.Responses = append(r.Responses, Response{
			FieldID: Str(resp["fieldId"]),
			Label:   Str(resp["label"]),
			Type:    Str(resp["type"]),
			Value:   resp["value"],
		})
	}
	if r.Responses == nil {
		r.Responses = []Response{}
	}
	if r.CheckingStatus == "" {
		r.CheckingStatus = CheckinPending
	}
	return r
}

// NewRegistrationDoc builds the document to write. The shape mirrors the
// existing collection exactly, including the empty-string paymentStatus and the
// null teamId/teamInviteCode that individual registrations carry.
func NewRegistrationDoc(u *User, e *Event, teamID, inviteCode string, fee int, responses []Response) map[string]any {
	doc := map[string]any{
		"userId":         u.UserID,
		"eventId":        e.EventID,
		"teamId":         nil,
		"teamInviteCode": nil,
		"status":         RegStatusConfirmed,
		"checkingStatus": CheckinPending,
		"paymentStatus":  "",
		"user":           u.RegistrationSnapshot(),
		"paymentDetails": map[string]any{"amount": fee},
		"responses":      ResponsesToDocs(responses),
		"registeredAt":   NowString(),
		"eventName":      e.Title,
		"eventType":      e.EventType,
		"eventCategory":  e.Category,
	}
	if teamID != "" {
		doc["teamId"] = teamID
		doc["teamInviteCode"] = inviteCode
	}
	return doc
}

func ResponsesToDocs(rs []Response) []map[string]any {
	out := make([]map[string]any, 0, len(rs))
	for _, r := range rs {
		out = append(out, map[string]any{
			"fieldId": r.FieldID,
			"label":   r.Label,
			"type":    r.Type,
			"value":   r.Value,
		})
	}
	return out
}
