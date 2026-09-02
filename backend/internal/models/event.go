package models

import (
	"slices"
	"strings"
	"time"

	"backend/internal/isotime"
)

const (
	EventTypeIndividual  = "individual"
	EventTypeTeam        = "team"
	EventTypeExternalLnk = "externalLink"
)

var EventCategories = []string{"Technical", "Cultural", "Business"}

func ValidEventType(t string) bool {
	return t == EventTypeIndividual || t == EventTypeTeam || t == EventTypeExternalLnk
}

func ValidCategory(c string) bool { return slices.Contains(EventCategories, c) }

type Fee struct {
	Host  int `json:"host"  firestore:"host"`
	Other int `json:"other" firestore:"other"`
}

type CustomField struct {
	FieldID  string   `json:"fieldId"           firestore:"fieldId"`
	Label    string   `json:"label"             firestore:"label"`
	Type     string   `json:"type"              firestore:"type"`
	Required bool     `json:"required"          firestore:"required"`
	Options  []string `json:"options,omitempty" firestore:"options"`
}

type Event struct {
	// ID is the document ID and is never written inside the document.
	ID string `json:"id" firestore:"-"`
	// EventID is the same value, kept as a real field because registrations
	// query on it and their document IDs are built by concatenating it.
	EventID              string           `json:"eventId"              firestore:"eventId"`
	Title                string           `json:"title"                firestore:"title"`
	Description          string           `json:"description"          firestore:"description"`
	ShortDescription     string           `json:"shortDescription"     firestore:"shortDescription"`
	Category             string           `json:"category"             firestore:"category"`
	EventType            string           `json:"eventType"            firestore:"eventType"`
	StartDateTime        string           `json:"startDateTime"        firestore:"startDateTime"`
	EndDateTime          string           `json:"endDateTime"          firestore:"endDateTime"`
	RegistrationDeadline string           `json:"registrationDeadline" firestore:"registrationDeadline"`
	VenueID              string           `json:"venueId"              firestore:"venueId"`
	VenueName            string           `json:"venueName"            firestore:"venueName"`
	CoverImage           string           `json:"coverImage"           firestore:"coverImage"`
	Links                []map[string]any `json:"links"                firestore:"links"`
	Coordinators         []map[string]any `json:"coordinators"         firestore:"coordinators"`
	ReelsID              []string         `json:"reelsId"              firestore:"reelsId"`
	Prizes               string           `json:"prizes"               firestore:"prizes"`
	ShortPrizes          string           `json:"shortPrizes"          firestore:"shortPrizes"`
	Rules                string           `json:"rules"                firestore:"rules"`
	MinTeamSize          int              `json:"minTeamSize"          firestore:"minTeamSize"`
	MaxTeamSize          int              `json:"maxTeamSize"          firestore:"maxTeamSize"`
	MaxParticipants      int              `json:"maxParticipants"      firestore:"maxParticipants"`
	IsPublic             bool             `json:"isPublic"             firestore:"isPublic"`
	IsFeatured           bool             `json:"isFeatured"           firestore:"isFeatured"`
	SameCollegeOnly      bool             `json:"sameCollegeOnly"      firestore:"sameCollegeOnly"`
	RequiresApproval     bool             `json:"requiresApproval"     firestore:"requiresApproval"`
	CustomFields         []CustomField    `json:"customFields"         firestore:"customFields"`
	ExternalURL          string           `json:"externalUrl"          firestore:"externalUrl"`
	CreatedAt            string           `json:"createdAt"            firestore:"createdAt"`
	CreatedBy            string           `json:"createdBy"            firestore:"createdBy"`
	UpdatedAt            string           `json:"updatedAt"            firestore:"updatedAt"`

	// Computed per response, never stored.
	RegisteredCount  int  `json:"registeredCount"        firestore:"-"`
	SeatsLeft        *int `json:"seatsLeft"              firestore:"-"`
	RegistrationOpen bool `json:"registrationOpen"       firestore:"-"`
	EffectiveFee     *int `json:"effectiveFee,omitempty" firestore:"-"`

	// Payments are not wired up yet: the fee is computed and displayed but
	// nothing collects it. See config.PaymentsEnforced.
	PaymentRequired bool   `json:"paymentRequired" firestore:"paymentRequired"`
	PaymentStarted  bool   `json:"paymentStarted"  firestore:"paymentStarted"`
	PaymentType     string `json:"paymentType"     firestore:"paymentType"`
	RegistrationFee Fee    `json:"registrationFee" firestore:"registrationFee"`
}

// Normalise fills the slice fields so a decoded event always serialises its
// arrays as [] rather than null.
func (e *Event) Normalise() {
	if e.Links == nil {
		e.Links = []map[string]any{}
	}
	if e.Coordinators == nil {
		e.Coordinators = []map[string]any{}
	}
	if e.ReelsID == nil {
		e.ReelsID = []string{}
	}
	if e.CustomFields == nil {
		e.CustomFields = []CustomField{}
	}
}

// FeeFor prices one user. Host students and external participants are priced
// separately, which is exactly what registrationFee.host and .other mean.
func (e *Event) FeeFor(isHost bool) int {
	if !e.PaymentRequired {
		return 0
	}
	if isHost {
		return e.RegistrationFee.Host
	}
	return e.RegistrationFee.Other
}

// Unlimited capacity is expressed as 0, which is also what an absent field
// decodes to.
func (e *Event) Unlimited() bool { return e.MaxParticipants <= 0 }

func (e *Event) IsRegistrationOpen(now time.Time) bool {
	if !e.IsPublic {
		return false
	}
	if e.RegistrationDeadline == "" {
		return true
	}
	deadline, ok := isotime.Parse(e.RegistrationDeadline)
	if !ok {
		return true
	}
	return now.Before(deadline)
}

// Matches powers the in-memory search. Firestore cannot do substring matching,
// so GET /events filters a cached slice instead, which also means the search is
// a real substring match rather than whole-word only.
func (e *Event) Matches(q string) bool {
	if q == "" {
		return true
	}
	q = strings.ToLower(q)
	for _, field := range []string{e.Title, e.ShortDescription, e.Description, e.Category, e.VenueName} {
		if strings.Contains(strings.ToLower(field), q) {
			return true
		}
	}
	return false
}

// Clone returns a shallow copy so a handler can attach per-request computed
// values without mutating the shared cached instance. The slice fields are
// read-only after construction.
func (e *Event) Clone() *Event {
	c := *e
	return &c
}
