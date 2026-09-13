package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/models"
	"backend/internal/slug"
	"backend/internal/store"
)

// venueBody has no venueId: it is a slug of the name, fixed at creation.
type venueBody struct {
	VenueName *string  `json:"venueName"`
	Lat       *float64 `json:"lat"`
	Lng       *float64 `json:"lng"`
}

func (a *API) ListVenues(c *gin.Context) {
	venues, err := a.Venues.All(c.Request.Context())
	if err != nil {
		log.Printf("ListVenues error: %v", err)
		apierr.Respond(c, apierr.Internal("could not load venues"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": venues})
}

// CreateVenue adds a venue keyed by a slug of its name, so "Activity Space 2"
// becomes activity-space-2 — the same ID events store in venueId.
func (a *API) CreateVenue(c *gin.Context) {
	var body venueBody
	if !bind(c, &body) {
		return
	}
	if body.VenueName == nil || body.Lat == nil || body.Lng == nil {
		apierr.Respond(c, apierr.BadRequest("missing_fields", "venueName, lat and lng are required"))
		return
	}

	id := slug.Make(*body.VenueName)
	if id == "" {
		apierr.Respond(c, apierr.BadRequest("invalid_name", "venueName must contain letters or digits"))
		return
	}

	venue := &models.Venue{VenueID: id}
	applyVenueBody(venue, &body)
	if err := validateVenue(venue); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.CreateVenue(c.Request.Context(), venue); err != nil {
		if errors.Is(err, store.ErrExists) {
			apierr.Respond(c, apierr.Conflict("venue_exists", "a venue with that name already exists").
				WithDetails(gin.H{"venueId": id}))
			return
		}
		apierr.Respond(c, apierr.Internal("could not create the venue"))
		return
	}
	a.Venues.Invalidate()

	c.JSON(http.StatusCreated, gin.H{"venue": venue})
}

// UpdateVenue can rename or move a venue, but its ID never changes. Events keep
// their own copy of venueName, so a rename does not reach them.
func (a *API) UpdateVenue(c *gin.Context) {
	ctx := c.Request.Context()

	venue, err := a.Store.GetVenue(ctx, c.Param("id"))
	if err != nil {
		respondVenueLookup(c, err)
		return
	}

	var body venueBody
	if !bind(c, &body) {
		return
	}
	if applyVenueBody(venue, &body) == 0 {
		apierr.Respond(c, apierr.BadRequest("empty_patch", "no updatable fields supplied"))
		return
	}
	if err := validateVenue(venue); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.SaveVenue(ctx, venue); err != nil {
		apierr.Respond(c, apierr.Internal("could not update the venue"))
		return
	}
	a.Venues.Invalidate()

	c.JSON(http.StatusOK, gin.H{"venue": venue})
}

// DeleteVenue refuses while any event still references the venue.
func (a *API) DeleteVenue(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	if _, err := a.Store.GetVenue(ctx, id); err != nil {
		respondVenueLookup(c, err)
		return
	}

	n, err := a.Store.VenueInUse(ctx, id)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not check events at this venue"))
		return
	}
	if n > 0 {
		apierr.Respond(c, apierr.Conflict("venue_in_use", "events still reference this venue").
			WithDetails(gin.H{"events": n}))
		return
	}

	if err := a.Store.DeleteVenue(ctx, id); err != nil {
		apierr.Respond(c, apierr.Internal("could not delete the venue"))
		return
	}
	a.Venues.Invalidate()

	c.Status(http.StatusNoContent)
}

func respondVenueLookup(c *gin.Context, err error) {
	if errors.Is(err, store.ErrNotFound) {
		apierr.Respond(c, apierr.NotFound("venue_not_found", "no such venue"))
		return
	}
	apierr.Respond(c, apierr.Internal("could not load the venue"))
}

// applyVenueBody overlays the supplied fields and reports how many were set.
func applyVenueBody(v *models.Venue, b *venueBody) int {
	n := 0
	if b.VenueName != nil {
		v.VenueName = strings.TrimSpace(*b.VenueName)
		n++
	}
	if b.Lat != nil {
		v.Lat = *b.Lat
		n++
	}
	if b.Lng != nil {
		v.Lng = *b.Lng
		n++
	}
	return n
}

func validateVenue(v *models.Venue) *apierr.Error {
	if v.VenueName == "" {
		return apierr.BadRequest("missing_fields", "venueName is required")
	}
	if v.Lat < -90 || v.Lat > 90 || v.Lng < -180 || v.Lng > 180 {
		return apierr.BadRequest("invalid_coordinates", "lat must be within ±90 and lng within ±180")
	}
	return nil
}
