package models

import (
	"slices"
	"strings"
	"time"
	"unicode"

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
	HostOnly bool     `json:"hostOnly,omitempty" firestore:"hostOnly,omitempty"`
	Audience string   `json:"audience,omitempty" firestore:"audience,omitempty"`
	Options  []string `json:"options,omitempty" firestore:"options"`
}

func (cf *CustomField) IsHostOnly() bool {
	if cf == nil {
		return false
	}
	if cf.HostOnly || strings.EqualFold(cf.Audience, "host_only") || strings.EqualFold(cf.Audience, "host") {
		return true
	}
	fid := strings.ToLower(cf.FieldID)
	return strings.Contains(fid, "host") || fid == "ppt_drive_link"
}

// IsProfileRedundantField checks whether a custom field asks for profile info
// (phone, gender, age, dob) that is already captured during user profile creation.
func IsProfileRedundantField(fieldID, label string) bool {
	combined := strings.ToLower(fieldID + " " + label)
	tokens := strings.FieldsFunc(combined, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
	for _, t := range tokens {
		switch t {
		case "phone", "phonenumber", "mobile", "gender", "age", "dob":
			return true
		}
	}
	return false
}

// FilterCustomFieldsFor replaces e.CustomFields with a filtered copy visible to the caller.
// If isHost is false, host-only fields are omitted. For host students, host-only and PPT fields are marked required.
// Profile-redundant fields (phone, gender, age) are omitted for all callers.
func (e *Event) FilterCustomFieldsFor(isHost bool) {
	if len(e.CustomFields) == 0 {
		return
	}
	visible := make([]CustomField, 0, len(e.CustomFields))
	for _, f := range e.CustomFields {
		if IsProfileRedundantField(f.FieldID, f.Label) {
			continue
		}
		if !isHost && f.IsHostOnly() {
			continue
		}
		if isHost && (f.IsHostOnly() || strings.Contains(strings.ToLower(f.FieldID), "ppt") || strings.Contains(strings.ToLower(f.Label), "presentation")) {
			f.Required = true
		}
		visible = append(visible, f)
	}
	e.CustomFields = visible
}

type Event struct {
	// ID is the document ID and is never written inside the document.
	ID string `json:"id" firestore:"-"`
	// EventID is the same value, kept as a real field because registrations
	// query on it and their document IDs are built by concatenating it.
	EventID              string           `json:"eventId"              firestore:"eventId"`
	Aliases              []string         `json:"aliases,omitempty"    firestore:"-"`
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

// IsPerIndividual checks if the event fee is priced per participant rather than a flat team fee.
func (e *Event) IsPerIndividual() bool {
	if e == nil {
		return false
	}
	pt := strings.ToLower(strings.TrimSpace(e.PaymentType))
	return pt == "per_individual" || pt == "perhead" || pt == "per_head" || pt == "individual"
}

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
