package models

import (
	"fmt"

	"backend/internal/isotime"
)

const (
	RegStatusConfirmed = "confirmed"
	RegStatusPending   = "pending"

	CheckinPending = "pending"
	CheckinDone    = "checked-in"
)

// RegistrationID is the document ID: "{eventId}_{userId}". Because it is
// derived from the pair, a Create with a must-not-exist precondition is itself
// the double-registration guard, with no read-then-write race.
func RegistrationID(eventID, userID string) string {
	return fmt.Sprintf("%s_%s", eventID, userID)
}

type Response struct {
	FieldID string `json:"fieldId" firestore:"fieldId"`
	Label   string `json:"label"   firestore:"label"`
	Type    string `json:"type"    firestore:"type"`
	Value   any    `json:"value"   firestore:"value"`
}

// Registration carries no copy of the user or of the event. Both are read from
// their own collections, so a renamed event or an edited phone number cannot
// leave a stale duplicate behind on thousands of registration documents.
type Registration struct {
	// ID is the document ID and is never written inside the document.
	ID             string `json:"registrationId" firestore:"-"`
	UserID         string `json:"userId"                   firestore:"userId"`
	EventID        string `json:"eventId"                  firestore:"eventId"`
	TeamID         string `json:"teamId,omitempty"         firestore:"teamId"`
	TeamInviteCode string `json:"teamInviteCode,omitempty" firestore:"teamInviteCode"`
	Status         string `json:"status"                   firestore:"status"`
	// CheckingStatus is the on-site check-in state, flipped when a QR is scanned.
	CheckingStatus string     `json:"checkingStatus" firestore:"checkingStatus"`
	PaymentStatus  string     `json:"paymentStatus"  firestore:"paymentStatus"`
	Responses      []Response `json:"responses"      firestore:"responses"`
	RegisteredAt   string     `json:"registeredAt"   firestore:"registeredAt"`
	PaidAt         string     `json:"paidAt,omitempty" firestore:"paidAt"`

	// Computed per response, never stored.
	QRToken string `json:"qrToken,omitempty" firestore:"-"`

	PaymentDetails map[string]any `json:"paymentDetails" firestore:"paymentDetails"`
}

// NewRegistration builds the document to write. teamID is the team document ID
// and is empty for an individual registration.
func NewRegistration(userID, eventID, teamID, inviteCode string, fee int, responses []Response) *Registration {
	if responses == nil {
		responses = []Response{}
	}
	return &Registration{
		UserID:         userID,
		EventID:        eventID,
		TeamID:         teamID,
		TeamInviteCode: inviteCode,
		Status:         RegStatusConfirmed,
		CheckingStatus: CheckinPending,
		Responses:      responses,
		RegisteredAt:   isotime.Now(),
		PaymentDetails: map[string]any{"amount": fee},
	}
}

func (r *Registration) Normalise() {
	if r.Responses == nil {
		r.Responses = []Response{}
	}
	if r.PaymentDetails == nil {
		r.PaymentDetails = map[string]any{}
	}
	if r.CheckingStatus == "" {
		r.CheckingStatus = CheckinPending
	}
}
