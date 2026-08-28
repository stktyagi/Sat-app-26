package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/slug"
	"backend/internal/store"
)

// eventBody is the admin-facing shape. Pointers make a partial update possible:
// an omitted field is left alone, which is what PATCH needs.
type eventBody struct {
	Title                *string           `json:"title"`
	Description          *string           `json:"description"`
	ShortDescription     *string           `json:"shortDescription"`
	Category             *string           `json:"category"`
	EventType            *string           `json:"eventType"`
	StartDateTime        *string           `json:"startDateTime"`
	EndDateTime          *string           `json:"endDateTime"`
	RegistrationDeadline *string           `json:"registrationDeadline"`
	VenueID              *string           `json:"venueId"`
	VenueName            *string           `json:"venueName"`
	CoverImage           *string           `json:"coverImage"`
	Images               *[]string         `json:"images"`
	Links                *[]map[string]any `json:"links"`
	Coordinators         *[]map[string]any `json:"coordinators"`
	Prizes               *string           `json:"prizes"`
	ShortPrizes          *string           `json:"shortPrizes"`
	Rules                *string           `json:"rules"`
	MinTeamSize          *int              `json:"minTeamSize"`
	MaxTeamSize          *int              `json:"maxTeamSize"`
	MaxParticipants      *int              `json:"maxParticipants"`
	IsPublic             *bool             `json:"isPublic"`
	IsFeatured           *bool             `json:"isFeatured"`
	SameCollegeOnly      *bool             `json:"sameCollegeOnly"`
	RequiresApproval     *bool             `json:"requiresApproval"`
	PaymentRequired      *bool             `json:"paymentRequired"`
	PaymentType          *string           `json:"paymentType"`
	RegistrationFee      *models.Fee       `json:"registrationFee"`
	CustomFields         *[]map[string]any `json:"customFields"`
	ExternalURL          *string           `json:"externalUrl"`
}

// CreateEvent adds an event. The document ID is a kebab-case slug of the title,
// matching the convention the existing events already use, and eventId mirrors
// it the way every stored document does.
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

	doc := map[string]any{
		"eventId":        id,
		"createdAt":      models.NowString(),
		"updatedAt":      models.NowString(),
		"createdBy":      middleware.CurrentUser(c).UserID,
		"isPublic":       false,
		"isFeatured":     false,
		"minTeamSize":    0,
		"maxTeamSize":    0,
		"customFields":   []any{},
		"coordinators":   []any{},
		"links":          []any{},
		"images":         []any{},
		"reelsId":        []any{},
		"paymentStarted": false,
	}
	applyEventBody(doc, &body)

	if err := a.validateEvent(c, doc, true); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.CreateEvent(ctx, id, doc); err != nil {
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

// UpdateEvent applies a partial update. The slug is the document ID, so neither
// it nor eventId can change; and the event type is frozen once anyone has
// registered, because registrations carry a denormalised copy of it.
func (a *API) UpdateEvent(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	existing, err := a.Store.GetEvent(ctx, id)
	if err != nil {
		apierr.Respond(c, apierr.NotFound("event_not_found", "no such event"))
		return
	}

	var body eventBody
	if !bind(c, &body) {
		return
	}

	fields := map[string]any{}
	applyEventBody(fields, &body)
	if len(fields) == 0 {
		apierr.Respond(c, apierr.BadRequest("empty_patch", "no updatable fields supplied"))
		return
	}

	if body.EventType != nil && *body.EventType != existing.EventType {
		n, err := a.Store.CountRegistrations(ctx, existing.EventID)
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

	// Validate against the merged result so a partial update cannot leave the
	// event internally inconsistent, for example a deadline after the start.
	merged := mergeForValidation(existing, fields)
	if err := a.validateEvent(c, merged, false); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.UpdateEvent(ctx, id, fields); err != nil {
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
		if err := a.Store.UpdateEvent(ctx, id, map[string]any{"isPublic": false}); err != nil {
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

// ListEventRegistrations is the organiser roster.
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

	c.JSON(http.StatusOK, gin.H{"items": regs, "total": total, "limit": limit, "offset": offset})
}

// applyEventBody copies the supplied fields into a document map.
//
// Several fields are written twice. The events collection accumulated duplicate
// spellings across two generations of admin panel, and the older web admin
// panel still reads the legacy names, so writing only the canonical one would
// make fields render blank over there.
func applyEventBody(doc map[string]any, b *eventBody) {
	set := func(key string, v any) { doc[key] = v }

	if b.Title != nil {
		set("title", strings.TrimSpace(*b.Title))
	}
	if b.Description != nil {
		set("description", *b.Description)
	}
	if b.ShortDescription != nil {
		set("shortDescription", *b.ShortDescription)
	}
	if b.Category != nil {
		set("category", *b.Category)
	}
	if b.EventType != nil {
		set("eventType", *b.EventType)
	}
	if b.StartDateTime != nil {
		set("startDateTime", *b.StartDateTime)
		// dateTime is the older name for the same value and is still read by
		// parts of the existing platform.
		set("dateTime", *b.StartDateTime)
	}
	if b.EndDateTime != nil {
		set("endDateTime", *b.EndDateTime)
	}
	if b.RegistrationDeadline != nil {
		set("registrationDeadline", *b.RegistrationDeadline)
	}
	if b.VenueID != nil {
		set("venueId", *b.VenueID)
	}
	if b.VenueName != nil {
		set("venueName", *b.VenueName)
	}
	if b.CoverImage != nil {
		set("coverImage", *b.CoverImage)
		set("coverImageUrl", *b.CoverImage) // legacy spelling
	}
	if b.Images != nil {
		set("images", toAnySlice(*b.Images))
	}
	if b.Links != nil {
		set("links", toAnyMaps(*b.Links))
	}
	if b.Coordinators != nil {
		set("coordinators", toAnyMaps(*b.Coordinators))
	}
	if b.Prizes != nil {
		set("prizes", *b.Prizes)
	}
	if b.ShortPrizes != nil {
		set("shortPrizes", *b.ShortPrizes)
	}
	if b.Rules != nil {
		set("rules", *b.Rules)
	}
	if b.MinTeamSize != nil {
		set("minTeamSize", *b.MinTeamSize)
	}
	if b.MaxTeamSize != nil {
		set("maxTeamSize", *b.MaxTeamSize)
	}
	if b.MaxParticipants != nil {
		set("maxParticipants", *b.MaxParticipants)
	}
	if b.IsPublic != nil {
		set("isPublic", *b.IsPublic)
	}
	if b.IsFeatured != nil {
		set("isFeatured", *b.IsFeatured)
	}
	if b.SameCollegeOnly != nil {
		set("sameCollegeOnly", *b.SameCollegeOnly)
	}
	if b.RequiresApproval != nil {
		set("requiresApproval", *b.RequiresApproval)
		set("requireAdminApproval", *b.RequiresApproval) // legacy spelling
	}
	if b.PaymentRequired != nil {
		set("paymentRequired", *b.PaymentRequired)
		set("paymentEnabled", *b.PaymentRequired) // legacy spelling
	}
	if b.PaymentType != nil {
		set("paymentType", *b.PaymentType)
	}
	if b.RegistrationFee != nil {
		set("registrationFee", map[string]any{
			"host":  b.RegistrationFee.Host,
			"other": b.RegistrationFee.Other,
		})
		// The flat legacy pair. hostFee was stored as a string on the older
		// documents, so it is mirrored in that type.
		set("hostFee", models.Str(b.RegistrationFee.Host))
		set("otherFee", b.RegistrationFee.Other)
	}
	if b.CustomFields != nil {
		set("customFields", toAnyMaps(*b.CustomFields))
	}
	if b.ExternalURL != nil {
		set("externalUrl", *b.ExternalURL)
	}
}

// validateEvent checks a complete document. onCreate tightens the rules that
// only make sense when every field is present.
func (a *API) validateEvent(c *gin.Context, doc map[string]any, onCreate bool) *apierr.Error {
	category := models.Str(doc["category"])
	if category != "" && !models.ValidCategory(category) {
		return apierr.BadRequest("invalid_category", "unknown category").
			WithDetails(gin.H{"allowed": models.EventCategories})
	}

	eventType := models.Str(doc["eventType"])
	if eventType != "" && !models.ValidEventType(eventType) {
		return apierr.BadRequest("invalid_event_type", "unknown eventType").
			WithDetails(gin.H{"allowed": []string{
				models.EventTypeIndividual, models.EventTypeTeam, models.EventTypeExternalLnk,
			}})
	}

	start, hasStart := models.ParseTime(models.Str(doc["startDateTime"]))
	end, hasEnd := models.ParseTime(models.Str(doc["endDateTime"]))
	deadline, hasDeadline := models.ParseTime(models.Str(doc["registrationDeadline"]))

	for key, present := range map[string]bool{
		"startDateTime":        models.Str(doc["startDateTime"]) == "" || hasStart,
		"endDateTime":          models.Str(doc["endDateTime"]) == "" || hasEnd,
		"registrationDeadline": models.Str(doc["registrationDeadline"]) == "" || hasDeadline,
	} {
		if !present {
			return apierr.BadRequest("invalid_date", key+" must be an RFC3339 timestamp")
		}
	}

	if hasStart && hasEnd && end.Before(start) {
		return apierr.BadRequest("invalid_range", "endDateTime cannot be before startDateTime")
	}
	if hasStart && hasDeadline && start.Before(deadline) {
		return apierr.BadRequest("invalid_deadline", "registrationDeadline cannot be after startDateTime")
	}

	if eventType == models.EventTypeTeam {
		minSize, maxSize := models.Int(doc["minTeamSize"]), models.Int(doc["maxTeamSize"])
		if maxSize < 1 {
			return apierr.BadRequest("invalid_team_size", "a team event needs maxTeamSize of at least 1")
		}
		if minSize > maxSize {
			return apierr.BadRequest("invalid_team_size", "minTeamSize cannot exceed maxTeamSize")
		}
	}
	if eventType == models.EventTypeExternalLnk && onCreate && models.Str(doc["externalUrl"]) == "" {
		return apierr.BadRequest("missing_external_url", "an externalLink event needs externalUrl")
	}

	if venueID := models.Str(doc["venueId"]); venueID != "" {
		ok, err := a.Store.VenueExists(c.Request.Context(), venueID)
		if err != nil {
			return apierr.Internal("could not verify the venue")
		}
		if !ok {
			return apierr.BadRequest("unknown_venue", "no venue with that id").
				WithDetails(gin.H{"venueId": venueID})
		}
	}

	return nil
}

// mergeForValidation overlays a patch onto the stored event so validation sees
// the document as it will be after the write.
func mergeForValidation(e *models.Event, patch map[string]any) map[string]any {
	base := map[string]any{
		"category":             e.Category,
		"eventType":            e.EventType,
		"startDateTime":        e.StartDateTime,
		"endDateTime":          e.EndDateTime,
		"registrationDeadline": e.RegistrationDeadline,
		"minTeamSize":          e.MinTeamSize,
		"maxTeamSize":          e.MaxTeamSize,
		"venueId":              e.VenueID,
		"externalUrl":          e.ExternalURL,
	}
	for k, v := range patch {
		base[k] = v
	}
	return base
}

func toAnySlice(in []string) []any {
	out := make([]any, 0, len(in))
	for _, v := range in {
		out = append(out, v)
	}
	return out
}

func toAnyMaps(in []map[string]any) []any {
	out := make([]any, 0, len(in))
	for _, v := range in {
		out = append(out, v)
	}
	return out
}
