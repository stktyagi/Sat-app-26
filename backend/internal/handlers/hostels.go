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

func hostelJSON(h *models.Hostel) gin.H {
	return gin.H{
		"id":        h.ID,
		"name":      h.Name,
		"gender":    h.Gender,
		"capacity":  h.Capacity,
		"occupied":  h.Occupied,
		"remaining": h.Remaining(),
		"active":    h.Active,
		"isFull":    h.Occupied >= h.Capacity,
	}
}

// AdminListHostels returns every hostel with live occupancy.
func (a *API) AdminListHostels(c *gin.Context) {
	hostels, err := a.Store.ListHostels(c.Request.Context())
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load hostels"))
		return
	}
	out := make([]gin.H, 0, len(hostels))
	totalCap, totalOcc := 0, 0
	for _, h := range hostels {
		out = append(out, hostelJSON(h))
		if h.Active {
			totalCap += h.Capacity
			totalOcc += h.Occupied
		}
	}
	c.JSON(http.StatusOK, gin.H{"hostels": out, "totalCapacity": totalCap, "totalOccupied": totalOcc})
}

type hostelBody struct {
	ID       *string `json:"id"`
	Name     *string `json:"name"`
	Gender   *string `json:"gender"`
	Capacity *int    `json:"capacity"`
	Active   *bool   `json:"active"`
}

// AdminCreateHostel adds a hostel (EB only).
func (a *API) AdminCreateHostel(c *gin.Context) {
	var req hostelBody
	if !bind(c, &req) {
		return
	}
	name := ""
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
	}
	if name == "" {
		apierr.Respond(c, apierr.BadRequest("missing_name", "name is required"))
		return
	}
	if req.Capacity == nil || *req.Capacity < 0 {
		apierr.Respond(c, apierr.BadRequest("invalid_capacity", "capacity must be zero or more"))
		return
	}
	id := ""
	if req.ID != nil {
		id = slug.Make(*req.ID)
	}
	if id == "" {
		id = slug.Make(name)
	}
	if id == "" {
		apierr.Respond(c, apierr.BadRequest("invalid_id", "could not derive an id from the name"))
		return
	}
	gender := "any"
	if req.Gender != nil {
		gender = models.NormalizeHostelGender(*req.Gender)
	}
	active := true
	if req.Active != nil {
		active = *req.Active
	}
	h := &models.Hostel{ID: id, Name: name, Gender: gender, Capacity: *req.Capacity, Active: active}
	if err := a.Store.CreateHostel(c.Request.Context(), h); err != nil {
		if errors.Is(err, store.ErrExists) {
			apierr.Respond(c, apierr.Conflict("hostel_exists", "a hostel with this id already exists"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not create hostel"))
		return
	}
	c.JSON(http.StatusCreated, gin.H{"hostel": hostelJSON(h)})
}

// AdminUpdateHostel edits name, gender, capacity or active (EB only).
func (a *API) AdminUpdateHostel(c *gin.Context) {
	var req hostelBody
	if !bind(c, &req) {
		return
	}
	p := store.HostelPatch{Capacity: req.Capacity, Active: req.Active}
	if req.Capacity != nil && *req.Capacity < 0 {
		apierr.Respond(c, apierr.BadRequest("invalid_capacity", "capacity must be zero or more"))
		return
	}
	if req.Name != nil {
		n := strings.TrimSpace(*req.Name)
		if n == "" {
			apierr.Respond(c, apierr.BadRequest("missing_name", "name cannot be empty"))
			return
		}
		p.Name = &n
	}
	if req.Gender != nil {
		g := models.NormalizeHostelGender(*req.Gender)
		p.Gender = &g
	}
	h, err := a.Store.UpdateHostel(c.Request.Context(), c.Param("id"), p)
	if err != nil {
		respondHostelErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"hostel": hostelJSON(h)})
}

// AdminDeskAllot assigns a hostel to a participant at the registration desk.
func (a *API) AdminDeskAllot(c *gin.Context) {
	var req struct {
		UserID   string `json:"userId"`
		HostelID string `json:"hostelId"`
		RoomNo   string `json:"roomNo"`
	}
	if !bind(c, &req) {
		return
	}
	uid, hid := strings.TrimSpace(req.UserID), strings.TrimSpace(req.HostelID)
	if uid == "" || hid == "" {
		apierr.Respond(c, apierr.BadRequest("missing_fields", "userId and hostelId are required"))
		return
	}
	u, err := a.Store.AllotHostel(c.Request.Context(), uid, hid, strings.TrimSpace(req.RoomNo), callerID(middleware.CurrentUser(c)))
	if err != nil {
		respondHostelErr(c, err)
		return
	}
	h, _ := a.Store.GetHostel(c.Request.Context(), hid)
	caller := middleware.CurrentUser(c)
	hName := hid
	if h != nil && h.Name != "" {
		hName = h.Name
	}
	a.LogAudit("desk_allot", "hospitality", caller, u, map[string]any{
		"hostelId":   hid,
		"hostelName": hName,
		"roomNo":     strings.TrimSpace(req.RoomNo),
	})

	resp := gin.H{
		"success": true,
		"data": gin.H{
			"userId":        u.UserID,
			"checkInStatus": checkInStatusJSON(u.CheckInStatus),
		},
	}
	if h != nil {
		resp["hostel"] = hostelJSON(h)
	}
	c.JSON(http.StatusOK, resp)
}
