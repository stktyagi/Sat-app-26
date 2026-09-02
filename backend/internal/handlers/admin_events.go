package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/isotime"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/slug"
	"backend/internal/store"
)

// eventBody is the admin-facing shape. Pointers make a partial update possible:
// an omitted field is left alone, which is what PATCH needs.
type eventBody struct {
	Title                *string               `json:"title"`
	Description          *string               `json:"description"`
	ShortDescription     *string               `json:"shortDescription"`
	Category             *string               `json:"category"`
	EventType            *string               `json:"eventType"`
	StartDateTime        *string               `json:"startDateTime"`
	EndDateTime          *string               `json:"endDateTime"`
	RegistrationDeadline *string               `json:"registrationDeadline"`
	VenueID              *string               `json:"venueId"`
	VenueName            *string               `json:"venueName"`
	CoverImage           *string               `json:"coverImage"`
	Links                *[]map[string]any     `json:"links"`
	Coordinators         *[]map[string]any     `json:"coordinators"`
	ReelsID              *[]string             `json:"reelsId"`
	Prizes               *string               `json:"prizes"`
	ShortPrizes          *string               `json:"shortPrizes"`
	Rules                *string               `json:"rules"`
	MinTeamSize          *int                  `json:"minTeamSize"`
	MaxTeamSize          *int                  `json:"maxTeamSize"`
	MaxParticipants      *int                  `json:"maxParticipants"`
	IsPublic             *bool                 `json:"isPublic"`
	IsFeatured           *bool                 `json:"isFeatured"`
	SameCollegeOnly      *bool                 `json:"sameCollegeOnly"`
	RequiresApproval     *bool                 `json:"requiresApproval"`
	PaymentRequired      *bool                 `json:"paymentRequired"`
	PaymentType          *string               `json:"paymentType"`
	RegistrationFee      *models.Fee           `json:"registrationFee"`
	CustomFields         *[]models.CustomField `json:"customFields"`
	ExternalURL          *string               `json:"externalUrl"`
}

// CreateEvent adds an event. The document ID is a kebab-case slug of the title,
// so titles must be unique, and eventId mirrors it because registration
// document IDs are built by concatenating it with a user ID.
func (a *API) CreateEvent(c *gin.Context) {
	ctx := c.Request.Context()

	var body eventBody
	if !bind(c, &body) {
		return
	}
	if body.Title == nil || strings.TrimSpace(*body.Title) == "" {
		apierr.Respond(c, apierr.BadRequest("missing_title", "title is required"))
		return
	}
	if body.Category == nil || body.EventType == nil {
		apierr.Respond(c, apierr.BadRequest("missing_fields", "category and eventType are required"))
		return
	}

	id := slug.Make(*body.Title)
	if id == "" {
		apierr.Respond(c, apierr.BadRequest("invalid_title", "title must contain letters or digits"))
		return
	}

	now := isotime.Now()
	event := &models.Event{
		ID:        id,
		EventID:   id,
		CreatedAt: now,
		UpdatedAt: now,
		CreatedBy: middleware.CurrentUser(c).UserID,
	}
	applyEventBody(event, &body)
	event.Normalise()

	if err := a.validateEvent(c, event, true); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.CreateEvent(ctx, event); err != nil {
		if errors.Is(err, store.ErrExists) {
			apierr.Respond(c, apierr.Conflict("event_exists", "an event with that title already exists").
				WithDetails(gin.H{"eventId": id}))
			return
		}
		apierr.Respond(c, apierr.Internal("could not create the event"))
		return
	}
	a.Cache.Invalidate()

	created, err := a.Cache.Get(ctx, id)
	if err != nil {
		apierr.Respond(c, apierr.Internal("event created but could not be read back"))
		return
	}
	c.JSON(http.StatusCreated, gin.H{"event": created})
}

// UpdateEvent applies a partial update by overlaying the supplied fields onto
// the stored event and writing the whole document back. Validating the merged
// result is what stops a patch that moves only the start date from leaving the
// deadline after it.
//
// The slug is the document ID, so neither it nor eventId can change; and the
// event type is frozen once anyone has registered, because flipping individual
// to team would leave existing registrations with no team.
func (a *API) UpdateEvent(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	event, err := a.Store.GetEvent(ctx, id)
	if err != nil {
		apierr.Respond(c, apierr.NotFound("event_not_found", "no such event"))
		return
	}
	originalType := event.EventType

	var body eventBody
	if !bind(c, &body) {
		return
	}
	if applyEventBody(event, &body) == 0 {
		apierr.Respond(c, apierr.BadRequest("empty_patch", "no updatable fields supplied"))
		return
	}
	event.Normalise()

	if event.EventType != originalType {
		n, err := a.Store.CountRegistrations(ctx, event.EventID)
		if err != nil {
			apierr.Respond(c, apierr.Internal("could not check existing registrations"))
			return
		}
		if n > 0 {
			apierr.Respond(c, apierr.Conflict("type_locked",
				"the event type cannot change once people have registered").
				WithDetails(gin.H{"registrations": n}))
			return
		}
	}

	if err := a.validateEvent(c, event, false); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.SaveEvent(ctx, event); err != nil {
		apierr.Respond(c, apierr.Internal("could not update the event"))
		return
	}
	a.Cache.Invalidate()

	updated, err := a.Cache.Get(ctx, id)
	if err != nil {
		apierr.Respond(c, apierr.Internal("event updated but could not be read back"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"event": updated})
}

// DeleteEvent hard-deletes only an event nobody has registered for. Once there
// are registrations, deleting the event would orphan them, so the default is to
// refuse; force=true unpublishes instead.
func (a *API) DeleteEvent(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	event, err := a.Store.GetEvent(ctx, id)
	if err != nil {
		apierr.Respond(c, apierr.NotFound("event_not_found", "no such event"))
		return
	}

	n, err := a.Store.CountRegistrations(ctx, event.EventID)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not check existing registrations"))
		return
	}

	if n > 0 {
		if c.Query("force") != "true" {
			apierr.Respond(c, apierr.Conflict("has_registrations",
				"this event has registrations; retry with force=true to unpublish it instead").
				WithDetails(gin.H{"registrations": n}))
			return
		}
		if err := a.Store.SetEventFields(ctx, id, map[string]any{"isPublic": false}); err != nil {
			apierr.Respond(c, apierr.Internal("could not unpublish the event"))
			return
		}
		a.Cache.Invalidate()
		c.JSON(http.StatusOK, gin.H{"unpublished": true, "registrations": n})
		return
	}

	if err := a.Store.DeleteEvent(ctx, id); err != nil {
		apierr.Respond(c, apierr.Internal("could not delete the event"))
		return
	}
	a.Cache.Invalidate()

	c.Status(http.StatusNoContent)
}

// ListEventRegistrations is the organiser roster. A registration holds only a
// user ID, so the profiles are hydrated here in one batch read rather than
// being duplicated onto every registration document.
func (a *API) ListEventRegistrations(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	event, err := a.Store.GetEvent(ctx, id)
	if err != nil {
		apierr.Respond(c, apierr.NotFound("event_not_found", "no such event"))
		return
	}

	limit, offset := page(c)
	regs, err := a.Store.ListEventRegistrations(ctx, event.EventID, limit, offset)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load registrations"))
		return
	}
	total, err := a.Store.CountRegistrations(ctx, event.EventID)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not count registrations"))
		return
	}

	ids := make([]string, 0, len(regs))
	for _, r := range regs {
		ids = append(ids, r.UserID)
	}
	users, err := a.Store.GetUsers(ctx, ids)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load participant profiles"))
		return
	}

	items := make([]gin.H, 0, len(regs))
	for _, r := range regs {
		row := gin.H{"registration": r}
		if u, ok := users[r.UserID]; ok {
			row["user"] = u.ResolveHostStatus(a.Cfg.HostEmailDomain)
		}
		items = append(items, row)
	}

	c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "limit": limit, "offset": offset})
}

// applyEventBody overlays the supplied fields onto an event and reports how
// many were set, so a PATCH carrying nothing can be rejected.
func applyEventBody(e *models.Event, b *eventBody) int {
	n := 0
	set := func(supplied bool, apply func()) {
		if supplied {
			apply()
			n++
		}
	}

	set(b.Title != nil, func() { e.Title = strings.TrimSpace(*b.Title) })
	set(b.Description != nil, func() { e.Description = *b.Description })
	set(b.ShortDescription != nil, func() { e.ShortDescription = *b.ShortDescription })
	set(b.Category != nil, func() { e.Category = *b.Category })
	set(b.EventType != nil, func() { e.EventType = *b.EventType })
	set(b.StartDateTime != nil, func() { e.StartDateTime = *b.StartDateTime })
	set(b.EndDateTime != nil, func() { e.EndDateTime = *b.EndDateTime })
	set(b.RegistrationDeadline != nil, func() { e.RegistrationDeadline = *b.RegistrationDeadline })
	set(b.VenueID != nil, func() { e.VenueID = *b.VenueID })
	set(b.VenueName != nil, func() { e.VenueName = *b.VenueName })
	set(b.CoverImage != nil, func() { e.CoverImage = *b.CoverImage })
	set(b.Links != nil, func() { e.Links = *b.Links })
	set(b.Coordinators != nil, func() { e.Coordinators = *b.Coordinators })
	set(b.ReelsID != nil, func() { e.ReelsID = *b.ReelsID })
	set(b.Prizes != nil, func() { e.Prizes = *b.Prizes })
	set(b.ShortPrizes != nil, func() { e.ShortPrizes = *b.ShortPrizes })
	set(b.Rules != nil, func() { e.Rules = *b.Rules })
	set(b.MinTeamSize != nil, func() { e.MinTeamSize = *b.MinTeamSize })
	set(b.MaxTeamSize != nil, func() { e.MaxTeamSize = *b.MaxTeamSize })
	set(b.MaxParticipants != nil, func() { e.MaxParticipants = *b.MaxParticipants })
	set(b.IsPublic != nil, func() { e.IsPublic = *b.IsPublic })
	set(b.IsFeatured != nil, func() { e.IsFeatured = *b.IsFeatured })
	set(b.SameCollegeOnly != nil, func() { e.SameCollegeOnly = *b.SameCollegeOnly })
	set(b.RequiresApproval != nil, func() { e.RequiresApproval = *b.RequiresApproval })
	set(b.PaymentRequired != nil, func() { e.PaymentRequired = *b.PaymentRequired })
	set(b.PaymentType != nil, func() { e.PaymentType = *b.PaymentType })
	set(b.RegistrationFee != nil, func() { e.RegistrationFee = *b.RegistrationFee })
	set(b.CustomFields != nil, func() { e.CustomFields = *b.CustomFields })
	set(b.ExternalURL != nil, func() { e.ExternalURL = *b.ExternalURL })

	return n
}

// validateEvent checks a complete event. onCreate tightens the rules that only
// make sense when every field is present.
func (a *API) validateEvent(c *gin.Context, e *models.Event, onCreate bool) *apierr.Error {
	if e.Category != "" && !models.ValidCategory(e.Category) {
		return apierr.BadRequest("invalid_category", "unknown category").
			WithDetails(gin.H{"allowed": models.EventCategories})
	}
	if e.EventType != "" && !models.ValidEventType(e.EventType) {
		return apierr.BadRequest("invalid_event_type", "unknown eventType").
			WithDetails(gin.H{"allowed": []string{
				models.EventTypeIndividual, models.EventTypeTeam, models.EventTypeExternalLnk,
			}})
	}

	start, hasStart := isotime.Parse(e.StartDateTime)
	end, hasEnd := isotime.Parse(e.EndDateTime)
	deadline, hasDeadline := isotime.Parse(e.RegistrationDeadline)

	for key, valid := range map[string]bool{
		"startDateTime":        e.StartDateTime == "" || hasStart,
		"endDateTime":          e.EndDateTime == "" || hasEnd,
		"registrationDeadline": e.RegistrationDeadline == "" || hasDeadline,
	} {
		if !valid {
			return apierr.BadRequest("invalid_date", key+" must be an RFC3339 timestamp")
		}
	}

	if hasStart && hasEnd && end.Before(start) {
		return apierr.BadRequest("invalid_range", "endDateTime cannot be before startDateTime")
	}
	if hasStart && hasDeadline && start.Before(deadline) {
		return apierr.BadRequest("invalid_deadline", "registrationDeadline cannot be after startDateTime")
	}

	if e.EventType == models.EventTypeTeam {
		if e.MaxTeamSize < 1 {
			return apierr.BadRequest("invalid_team_size", "a team event needs maxTeamSize of at least 1")
		}
		if e.MinTeamSize > e.MaxTeamSize {
			return apierr.BadRequest("invalid_team_size", "minTeamSize cannot exceed maxTeamSize")
		}
	}
	if e.EventType == models.EventTypeExternalLnk && onCreate && e.ExternalURL == "" {
		return apierr.BadRequest("missing_external_url", "an externalLink event needs externalUrl")
	}

	for _, f := range e.CustomFields {
		if strings.TrimSpace(f.FieldID) == "" {
			return apierr.BadRequest("invalid_custom_field", "every custom field needs a fieldId")
		}
	}

	if e.VenueID != "" {
		ok, err := a.Store.VenueExists(c.Request.Context(), e.VenueID)
		if err != nil {
			return apierr.Internal("could not verify the venue")
		}
		if !ok {
			return apierr.BadRequest("unknown_venue", "no venue with that id").
				WithDetails(gin.H{"venueId": e.VenueID})
		}
	}

	return nil
}
