package models

import (
	"strings"
	"time"
)

const (
	EventTypeIndividual  = "individual"
	EventTypeTeam        = "team"
	EventTypeExternalLnk = "externalLink"
)

// Categories as they actually appear in the live data — capitalised.
var EventCategories = []string{"Technical", "Cultural", "Business"}

func ValidEventType(t string) bool {
	return t == EventTypeIndividual || t == EventTypeTeam || t == EventTypeExternalLnk
}

func ValidCategory(c string) bool {
	for _, v := range EventCategories {
		if v == c {
			return true
		}
	}
	return false
}

type Fee struct {
	Host  int `json:"host"`
	Other int `json:"other"`
}

type CustomField struct {
	FieldID  string   `json:"fieldId"`
	Label    string   `json:"label"`
	Type     string   `json:"type"`
	Required bool     `json:"required"`
	Options  []string `json:"options,omitempty"`
}

type Event struct {
	ID                   string           `json:"id"`
	EventID              string           `json:"eventId"`
	Title                string           `json:"title"`
	Description          string           `json:"description"`
	ShortDescription     string           `json:"shortDescription"`
	Category             string           `json:"category"`
	EventType            string           `json:"eventType"`
	DateTime             string           `json:"dateTime"`
	StartDateTime        string           `json:"startDateTime"`
	EndDateTime          string           `json:"endDateTime"`
	RegistrationDeadline string           `json:"registrationDeadline"`
	VenueID              string           `json:"venueId"`
	VenueName            string           `json:"venueName"`
	CoverImage           string           `json:"coverImage"`
	Images               []string         `json:"images"`
	Links                []map[string]any `json:"links"`
	Coordinators         []map[string]any `json:"coordinators"`
	ReelsID              []string         `json:"reelsId"`
	Prizes               string           `json:"prizes"`
	ShortPrizes          string           `json:"shortPrizes"`
	Rules                string           `json:"rules"`
	MinTeamSize          int              `json:"minTeamSize"`
	MaxTeamSize          int              `json:"maxTeamSize"`
	MaxParticipants      int              `json:"maxParticipants"`
	IsPublic             bool             `json:"isPublic"`
	IsFeatured           bool             `json:"isFeatured"`
	SameCollegeOnly      bool             `json:"sameCollegeOnly"`
	RequiresApproval     bool             `json:"requiresApproval"`
	PaymentRequired      bool             `json:"paymentRequired"`
	PaymentStarted       bool             `json:"paymentStarted"`
	PaymentType          string           `json:"paymentType"`
	RegistrationFee      Fee              `json:"registrationFee"`
	CustomFields         []CustomField    `json:"customFields"`
	ExternalURL          string           `json:"externalUrl,omitempty"`
	CreatedAt            string           `json:"createdAt,omitempty"`
	CreatedBy            string           `json:"createdBy,omitempty"`
	UpdatedAt            string           `json:"updatedAt,omitempty"`

	// Computed per response, never stored.
	RegisteredCount  int  `json:"registeredCount"`
	SeatsLeft        *int `json:"seatsLeft"`
	RegistrationOpen bool `json:"registrationOpen"`
	EffectiveFee     *int `json:"effectiveFee,omitempty"`
}

// EventFromDoc normalises one raw Firestore document. The Coalesce calls are
// where the legacy duplicate fields get resolved: some docs carry coverImage,
// others coverImageUrl; some carry a registrationFee map, others flat
// hostFee/otherFee.
func EventFromDoc(id string, m map[string]any) *Event {
	e := &Event{
		ID:                   id,
		EventID:              Str(Coalesce(m["eventId"], id)),
		Title:                Str(m["title"]),
		Description:          Str(m["description"]),
		ShortDescription:     Str(m["shortDescription"]),
		Category:             Str(m["category"]),
		EventType:            Str(m["eventType"]),
		DateTime:             Str(m["dateTime"]),
		StartDateTime:        Str(Coalesce(m["startDateTime"], m["dateTime"])),
		EndDateTime:          Str(m["endDateTime"]),
		RegistrationDeadline: Str(m["registrationDeadline"]),
		VenueID:              Str(m["venueId"]),
		VenueName:            Str(m["venueName"]),
		CoverImage:           Str(Coalesce(m["coverImage"], m["coverImageUrl"])),
		Images:               StrSlice(Coalesce(m["images"], m["additionalImages"])),
		Links:                MapSlice(m["links"]),
		Coordinators:         MapSlice(m["coordinators"]),
		ReelsID:              StrSlice(m["reelsId"]),
		Prizes:               Str(m["prizes"]),
		ShortPrizes:          Str(m["shortPrizes"]),
		Rules:                Str(m["rules"]),
		MinTeamSize:          Int(m["minTeamSize"]),
		MaxTeamSize:          Int(m["maxTeamSize"]),
		MaxParticipants:      Int(m["maxParticipants"]),
		IsPublic:             Bool(m["isPublic"]),
		IsFeatured:           Bool(m["isFeatured"]),
		SameCollegeOnly:      Bool(m["sameCollegeOnly"]),
		RequiresApproval:     Bool(Coalesce(m["requiresApproval"], m["requireAdminApproval"])),
		PaymentRequired:      Bool(Coalesce(m["paymentRequired"], m["paymentEnabled"])),
		PaymentStarted:       Bool(m["paymentStarted"]),
		PaymentType:          Str(m["paymentType"]),
		ExternalURL:          Str(m["externalUrl"]),
		CreatedAt:            Str(m["createdAt"]),
		CreatedBy:            Str(m["createdBy"]),
		UpdatedAt:            Str(m["updatedAt"]),
	}

	fee := Map(m["registrationFee"])
	e.RegistrationFee = Fee{
		Host:  Int(Coalesce(fee["host"], m["hostFee"])),
		Other: Int(Coalesce(fee["other"], m["otherFee"])),
	}

	for _, f := range MapSlice(Coalesce(m["customFields"], m["customRegistrationFields"])) {
		e.CustomFields = append(e.CustomFields, CustomField{
			FieldID:  Str(Coalesce(f["fieldId"], f["id"])),
			Label:    Str(f["label"]),
			Type:     Str(f["type"]),
			Required: Bool(f["required"]),
			Options:  StrSlice(f["options"]),
		})
	}

	if e.Images == nil {
		e.Images = []string{}
	}
	if e.CustomFields == nil {
		e.CustomFields = []CustomField{}
	}
	if e.Links == nil {
		e.Links = []map[string]any{}
	}
	if e.Coordinators == nil {
		e.Coordinators = []map[string]any{}
	}
	if e.ReelsID == nil {
		e.ReelsID = []string{}
	}
	return e
}

// Fee for one user. Host students and external participants are priced
// separately, which is exactly what registrationFee.host / .other mean.
func (e *Event) FeeFor(isHost bool) int {
	if !e.PaymentRequired {
		return 0
	}
	if isHost {
		return e.RegistrationFee.Host
	}
	return e.RegistrationFee.Other
}

// Unlimited capacity is expressed as 0 — which is also what an absent field or
// the empty string on a legacy document coerces to.
func (e *Event) Unlimited() bool { return e.MaxParticipants <= 0 }

func (e *Event) IsRegistrationOpen(now time.Time) bool {
	if !e.IsPublic {
		return false
	}
	if e.RegistrationDeadline == "" {
		return true
	}
	deadline, ok := ParseTime(e.RegistrationDeadline)
	if !ok {
		return true
	}
	return now.Before(deadline)
}

// Matches powers the in-memory search. Firestore cannot do substring matching,
// so GET /events filters a cached slice instead — which also means the search
// is a real substring match rather than whole-word only.
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
// values (seat counts, the fee for the calling user) without mutating the
// shared cached instance. The slice fields are read-only after construction.
func (e *Event) Clone() *Event {
	c := *e
	return &c
}
