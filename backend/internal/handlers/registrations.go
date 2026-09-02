package handlers

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/store"
)

type registerBody struct {
	Responses []models.Response `json:"responses"`
}

// Register creates an individual registration. The document ID is
// "{eventId}_{userId}", so Create either wins or fails: the duplicate check is
// the write itself and cannot be lost to a race.
func (a *API) Register(c *gin.Context) {
	ctx := c.Request.Context()
	user := middleware.CurrentUser(c)

	var body registerBody
	if c.Request.ContentLength > 0 && !bind(c, &body) {
		return
	}

	event, ok := a.loadVisibleEvent(c, c.Param("id"))
	if !ok {
		return
	}
	if err := a.checkRegistrable(ctx, event, user, models.EventTypeIndividual); err != nil {
		apierr.Respond(c, err)
		return
	}
	if err := validateResponses(event, body.Responses); err != nil {
		apierr.Respond(c, err)
		return
	}

	fee := event.FeeFor(user.IsHostCollegeStudent)
	id := models.RegistrationID(event.EventID, user.UserID)
	reg := models.NewRegistration(user.UserID, event.EventID, "", "", fee, body.Responses)

	if err := a.Store.CreateRegistration(ctx, id, reg); err != nil {
		if errors.Is(err, store.ErrExists) {
			apierr.Respond(c, apierr.Conflict("already_registered", "you are already registered for this event"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not register"))
		return
	}
	a.Cache.Invalidate()

	saved, err := a.Store.GetRegistration(ctx, id)
	if err != nil {
		apierr.Respond(c, apierr.Internal("registration saved but could not be read back"))
		return
	}
	saved.QRToken = a.QR.Sign(saved.ID)

	c.JSON(http.StatusCreated, gin.H{"registration": saved})
}

// Unregister removes an individual registration. Team members leave through the
// team endpoints instead, so that the members array stays consistent with the
// registration records.
func (a *API) Unregister(c *gin.Context) {
	ctx := c.Request.Context()
	user := middleware.CurrentUser(c)

	event, ok := a.loadVisibleEvent(c, c.Param("id"))
	if !ok {
		return
	}

	id := models.RegistrationID(event.EventID, user.UserID)
	reg, err := a.Store.GetRegistration(ctx, id)
	if err != nil {
		apierr.Respond(c, apierr.NotFound("not_registered", "you are not registered for this event"))
		return
	}
	if reg.TeamID != "" {
		apierr.Respond(c, apierr.Conflict("in_a_team", "leave the team instead: POST /api/v1/teams/{teamRef}/leave"))
		return
	}
	if !event.IsRegistrationOpen(time.Now()) {
		apierr.Respond(c, apierr.Conflict("registration_closed", "registration has closed for this event"))
		return
	}

	if err := a.Store.DeleteRegistration(ctx, id); err != nil {
		apierr.Respond(c, apierr.Internal("could not cancel the registration"))
		return
	}
	a.Cache.Invalidate()

	c.Status(http.StatusNoContent)
}

// GetRegistration returns one registration with its QR token. Readable by the
// owner or by an administrator.
func (a *API) GetRegistration(c *gin.Context) {
	user := middleware.CurrentUser(c)

	reg, err := a.Store.GetRegistration(c.Request.Context(), c.Param("id"))
	if err != nil {
		apierr.Respond(c, apierr.NotFound("registration_not_found", "no such registration"))
		return
	}
	if reg.UserID != user.UserID && !user.IsAdmin() {
		apierr.Respond(c, apierr.Forbidden("not_yours", "this registration belongs to someone else"))
		return
	}
	reg.QRToken = a.QR.Sign(reg.ID)

	c.JSON(http.StatusOK, gin.H{"registration": reg})
}

// checkRegistrable holds every rule shared by individual registration, team
// creation and team joining.
func (a *API) checkRegistrable(ctx context.Context, e *models.Event, u *models.User, wantType string) *apierr.Error {
	if e.EventType == models.EventTypeExternalLnk {
		return apierr.BadRequest("external_event", "this event is registered for elsewhere").
			WithDetails(gin.H{"externalUrl": e.ExternalURL})
	}
	if e.EventType != wantType {
		return apierr.BadRequest("wrong_event_type",
			"this is a "+e.EventType+" event; use the "+wantType+" registration endpoint")
	}
	if !e.IsRegistrationOpen(time.Now()) {
		return apierr.Conflict("registration_closed", "registration has closed for this event")
	}
	if e.SameCollegeOnly && !u.IsHostCollegeStudent {
		return apierr.Forbidden("host_college_only", "this event is open to host college students only")
	}

	// Capacity. Without a stored counter this is a count immediately before the
	// write, so simultaneous requests for the final seat can both pass. Adding
	// registeredCount to the event document and incrementing it inside the
	// transaction is the fix if that ever matters.
	if !e.Unlimited() {
		n, err := a.Store.CountRegistrations(ctx, e.EventID)
		if err != nil {
			return apierr.Internal("could not check remaining capacity")
		}
		if n >= e.MaxParticipants {
			return apierr.Conflict("event_full", "this event is full")
		}
	}

	// Payments are not wired up. While PAYMENTS_ENFORCED is false a fee-bearing
	// event still registers normally and the computed amount is recorded on the
	// registration, but nothing collects it.
	if a.Cfg.PaymentsEnforced {
		if fee := e.FeeFor(u.IsHostCollegeStudent); fee > 0 {
			return apierr.PaymentRequired("payment_required", "this event requires payment").
				WithDetails(gin.H{"amount": fee, "currency": "INR"})
		}
	}

	return nil
}

// validateResponses checks the submitted answers against the custom fields the
// event defines.
func validateResponses(e *models.Event, given []models.Response) *apierr.Error {
	if len(e.CustomFields) == 0 {
		return nil
	}
	supplied := map[string]bool{}
	for _, r := range given {
		if r.Value != nil && r.Value != "" {
			supplied[r.FieldID] = true
		}
	}
	for _, f := range e.CustomFields {
		if f.Required && !supplied[f.FieldID] {
			return apierr.BadRequest("missing_response", "a required answer is missing").
				WithDetails(gin.H{"fieldId": f.FieldID, "label": f.Label})
		}
	}
	return nil
}
