package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/store"
)

type qrScanRequest struct {
	Data     string `json:"data"`
	Category string `json:"category"` // "gate" | "hostel" | "event"
}

type gateCheckInRequest struct {
	UserID *string `json:"userId"`
	Fest   *bool   `json:"fest"`
	Remark *string `json:"remark"`
}

type hostelCheckInRequest struct {
	UserID        *string `json:"userId"`
	Accommodation *bool   `json:"accommodation"`
	Hostel        *string `json:"hostel"`
}

type eventCheckInRequest struct {
	RegistrationID *string `json:"registrationId"`
	Status         *string `json:"status"` // "checked in" | "rejected" | "pending"
}

// AdminQRScan processes scanned QR code payloads for gate, hostel, and event check-ins.
func (a *API) AdminQRScan(c *gin.Context) {
	var req qrScanRequest
	if !bind(c, &req) {
		return
	}

	trimmedData := strings.TrimSpace(req.Data)
	if trimmedData == "" {
		apierr.Respond(c, apierr.BadRequest("missing_data", "QR code data is required"))
		return
	}

	category := strings.ToLower(strings.TrimSpace(req.Category))
	if category == "" {
		category = "gate"
	}

	caller := middleware.CurrentUser(c)
	if category == "gate" || category == "hostel" {
		if caller != nil && !caller.IsAdmin() && !caller.HasRole(models.RoleEBHospitality) && !caller.HasRole(models.RoleECHospitality) {
			apierr.Respond(c, apierr.Forbidden("insufficient_permissions", "hospitality role required for gate and hostel scanning"))
			return
		}
	}
	if category == "event" {
		if caller != nil && !caller.IsAdmin() && !caller.HasRole(models.RoleEBEvents) && !caller.HasRole(models.RoleEventPOC) {
			apierr.Respond(c, apierr.Forbidden("insufficient_permissions", "event role required for event scanning"))
			return
		}
	}

	if category == "event" {
		a.handleEventQRScan(c, trimmedData)
		return
	}

	// For "gate" and "hostel", resolve the User document.
	a.handleUserQRScan(c, trimmedData, category)
}

func (a *API) handleEventQRScan(c *gin.Context, rawData string) {
	ctx := c.Request.Context()

	var reg *models.Registration
	var err error

	// 1. Try verifying as signed QR token
	if regID, verifyErr := a.QR.Verify(rawData); verifyErr == nil && regID != "" {
		reg, err = a.Store.GetRegistration(ctx, regID)
	}

	// 2. Try rawData directly as registration ID
	if reg == nil {
		reg, err = a.Store.GetRegistration(ctx, rawData)
	}

	// 3. If rawData has eventId_userId format, try directly
	if reg == nil && strings.Contains(rawData, "_") {
		reg, err = a.Store.GetRegistration(ctx, rawData)
	}

	// 4. If rawData is a userId, check if user has registrations
	if reg == nil {
		if regs, listErr := a.Store.ListUserRegistrations(ctx, rawData); listErr == nil && len(regs) > 0 {
			reg = regs[0]
			err = nil
		}
	}

	if reg == nil || err != nil {
		apierr.Respond(c, apierr.NotFound("registration_not_found", "No event registration found for this QR code"))
		return
	}

	// Hydrate User and Event
	u, _ := a.Store.GetUser(ctx, reg.UserID)
	evt, _ := a.Cache.Get(ctx, reg.EventID)

	caller := middleware.CurrentUser(c)
	if caller != nil && !caller.IsAdmin() && !caller.HasRole(models.RoleEBEvents) {
		if !caller.HasRole(models.RoleEventPOC) || !isUserEventCoordinator(caller, evt) {
			apierr.Respond(c, apierr.Forbidden("not_event_coordinator", "you are not an assigned coordinator for this event"))
			return
		}
	}

	eventName := "Event"
	if evt != nil && evt.Title != "" {
		eventName = evt.Title
	}

	userName := "Participant"
	userEmail := ""
	userPhone := ""
	if u != nil {
		if u.DisplayName != "" {
			userName = u.DisplayName
		}
		userEmail = u.Email
		userPhone = u.PhoneNumber
	}

	chkStatus := reg.CheckingStatus
	if chkStatus == "" {
		chkStatus = "pending"
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"category": "event",
		"data": gin.H{
			"registrationId": reg.ID,
			"userId":         reg.UserID,
			"eventId":        reg.EventID,
			"eventName":      eventName,
			"name":           userName,
			"displayName":    userName,
			"email":          userEmail,
			"phoneNumber":    userPhone,
			"status":         reg.Status,
			"checkingStatus": chkStatus,
			"paymentStatus":  reg.PaymentStatus,
			"teamId":         reg.TeamID,
		},
	})
}

func (a *API) handleUserQRScan(c *gin.Context, rawData, category string) {
	ctx := c.Request.Context()

	var user *models.User
	var err error

	// 1. Try verifying as signed QR token (which embeds registrationId: eventId_userId)
	if regID, verifyErr := a.QR.Verify(rawData); verifyErr == nil && regID != "" {
		if reg, regErr := a.Store.GetRegistration(ctx, regID); regErr == nil && reg != nil && reg.UserID != "" {
			user, err = a.Store.GetUser(ctx, reg.UserID)
		}
	}

	// 2. Try rawData directly as userId
	if user == nil {
		user, err = a.Store.GetUser(ctx, rawData)
	}

	// 3. Try rawData as email
	if user == nil && strings.Contains(rawData, "@") {
		user, err = a.Store.GetUserByEmail(ctx, rawData)
	}

	// 4. Try if rawData is eventId_userId
	if user == nil && strings.Contains(rawData, "_") {
		parts := strings.Split(rawData, "_")
		if len(parts) >= 2 {
			candidateUID := parts[len(parts)-1]
			user, err = a.Store.GetUser(ctx, candidateUID)
		}
	}

	if user == nil || err != nil {
		apierr.Respond(c, apierr.NotFound("user_not_found", "No user found for this QR code"))
		return
	}

	// Load user registered events
	regs, _ := a.Store.ListUserRegistrations(ctx, user.UserID)
	eventsList := make([]gin.H, 0, len(regs))
	for _, r := range regs {
		evtTitle := "Event"
		if e, err := a.Cache.Get(ctx, r.EventID); err == nil && e != nil && e.Title != "" {
			evtTitle = e.Title
		}
		status := r.Status
		if status == "" {
			status = "confirmed"
		}
		eventsList = append(eventsList, gin.H{
			"eventId":        r.EventID,
			"eventName":      evtTitle,
			"status":         status,
			"checkingStatus": r.CheckingStatus,
		})
	}

	resolvedUser := user.ResolveHostStatus(a.Cfg.HostEmailDomain)

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"category": category,
		"data": gin.H{
			"userId":               user.UserID,
			"displayName":          user.DisplayName,
			"name":                 user.DisplayName,
			"email":                user.Email,
			"phoneNumber":          user.PhoneNumber,
			"collegeName":          user.CollegeName,
			"isHostCollegeStudent": resolvedUser.IsHostCollegeStudent,
			"accommodationNeeded":  user.AccommodationNeeded,
			"accommodation":        user.Accommodation,
			"food":                 user.Food,
			"checkInStatus": gin.H{
				"fest":          user.CheckInStatus.Fest,
				"remark":        user.CheckInStatus.Remark,
				"accommodation": user.CheckInStatus.Accommodation,
				"Hostel":        user.CheckInStatus.Hostel,
			},
			"userEvents": eventsList,
		},
	})
}

// AdminGateCheckIn updates gate entry and remark for a user.
func (a *API) AdminGateCheckIn(c *gin.Context) {
	ctx := c.Request.Context()

	var req gateCheckInRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			apierr.Respond(c, apierr.BadRequest("invalid_body", err.Error()))
			return
		}
	}

	uid := c.Param("userId")
	if uid == "" && req.UserID != nil {
		uid = strings.TrimSpace(*req.UserID)
	}
	if uid == "" {
		apierr.Respond(c, apierr.BadRequest("missing_user_id", "userId is required"))
		return
	}

	u, err := a.Store.GetUser(ctx, uid)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Respond(c, apierr.NotFound("user_not_found", "User not found"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not load user"))
		return
	}

	festStatus := u.CheckInStatus.Fest
	if req.Fest != nil {
		festStatus = *req.Fest
	}

	remark := u.CheckInStatus.Remark
	if req.Remark != nil {
		remark = strings.TrimSpace(*req.Remark)
	}

	fields := map[string]any{
		"checkInStatus": map[string]any{
			"fest":          festStatus,
			"remark":        remark,
			"accommodation": u.CheckInStatus.Accommodation,
			"Hostel":        u.CheckInStatus.Hostel,
		},
	}

	updatedUser, err := a.Store.UpdateUser(ctx, uid, fields)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not update gate check-in status"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Gate entry updated successfully",
		"data": gin.H{
			"userId": updatedUser.UserID,
			"checkInStatus": gin.H{
				"fest":          updatedUser.CheckInStatus.Fest,
				"remark":        updatedUser.CheckInStatus.Remark,
				"accommodation": updatedUser.CheckInStatus.Accommodation,
				"Hostel":        updatedUser.CheckInStatus.Hostel,
			},
		},
	})
}

// AdminHostelCheckIn updates accommodation check-in status and hostel assignment.
func (a *API) AdminHostelCheckIn(c *gin.Context) {
	ctx := c.Request.Context()

	var req hostelCheckInRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			apierr.Respond(c, apierr.BadRequest("invalid_body", err.Error()))
			return
		}
	}

	uid := c.Param("userId")
	if uid == "" && req.UserID != nil {
		uid = strings.TrimSpace(*req.UserID)
	}
	if uid == "" {
		apierr.Respond(c, apierr.BadRequest("missing_user_id", "userId is required"))
		return
	}

	u, err := a.Store.GetUser(ctx, uid)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Respond(c, apierr.NotFound("user_not_found", "User not found"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not load user"))
		return
	}

	accommodationStatus := u.CheckInStatus.Accommodation
	if req.Accommodation != nil {
		accommodationStatus = *req.Accommodation
	}

	hostel := u.CheckInStatus.Hostel
	if req.Hostel != nil {
		hostel = strings.TrimSpace(*req.Hostel)
	}
	if !accommodationStatus {
		hostel = ""
	}

	fields := map[string]any{
		"checkInStatus": map[string]any{
			"fest":          u.CheckInStatus.Fest,
			"remark":        u.CheckInStatus.Remark,
			"accommodation": accommodationStatus,
			"Hostel":        hostel,
		},
	}

	updatedUser, err := a.Store.UpdateUser(ctx, uid, fields)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not update accommodation status"))
		return
	}
	a.Store.InvalidateAccommodationCache()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Accommodation status updated successfully",
		"data": gin.H{
			"userId": updatedUser.UserID,
			"checkInStatus": gin.H{
				"fest":          updatedUser.CheckInStatus.Fest,
				"remark":        updatedUser.CheckInStatus.Remark,
				"accommodation": updatedUser.CheckInStatus.Accommodation,
				"Hostel":        updatedUser.CheckInStatus.Hostel,
			},
		},
	})
}

// AdminEventCheckIn updates checkingStatus ("checked in", "rejected", "pending") on an event registration.
func (a *API) AdminEventCheckIn(c *gin.Context) {
	ctx := c.Request.Context()

	var req eventCheckInRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			apierr.Respond(c, apierr.BadRequest("invalid_body", err.Error()))
			return
		}
	}

	regID := c.Param("id")
	if regID == "" && req.RegistrationID != nil {
		regID = strings.TrimSpace(*req.RegistrationID)
	}
	if regID == "" {
		apierr.Respond(c, apierr.BadRequest("missing_registration_id", "registrationId is required"))
		return
	}

	status := "checked in"
	if req.Status != nil && strings.TrimSpace(*req.Status) != "" {
		status = strings.ToLower(strings.TrimSpace(*req.Status))
	}

	reg, err := a.Store.GetRegistration(ctx, regID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Respond(c, apierr.NotFound("registration_not_found", "Registration not found"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not load registration"))
		return
	}

	caller := middleware.CurrentUser(c)
	if caller != nil && !caller.IsAdmin() && !caller.HasRole(models.RoleEBEvents) {
		evt, _ := a.Cache.Get(ctx, reg.EventID)
		if !caller.HasRole(models.RoleEventPOC) || !isUserEventCoordinator(caller, evt) {
			apierr.Respond(c, apierr.Forbidden("not_event_coordinator", "you are not an assigned coordinator for this event"))
			return
		}
	}

	if err := a.Store.UpdateRegistrationCheckingStatus(ctx, reg.ID, status); err != nil {
		apierr.Respond(c, apierr.Internal("could not update registration check-in status"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Registration check-in status updated successfully",
		"data": gin.H{
			"registrationId": reg.ID,
			"checkingStatus": status,
		},
	})
}

// AdminGetUserEventsByID returns all registered events for a given user ID.
func (a *API) AdminGetUserEventsByID(c *gin.Context) {
	ctx := c.Request.Context()
	uid := c.Param("id")
	if uid == "" {
		apierr.Respond(c, apierr.BadRequest("missing_id", "User ID is required"))
		return
	}

	regs, err := a.Store.ListUserRegistrations(ctx, uid)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load registrations"))
		return
	}

	events := make([]gin.H, 0, len(regs))
	for _, reg := range regs {
		evtTitle := "Event"
		if event, err := a.Cache.Get(ctx, reg.EventID); err == nil && event != nil && event.Title != "" {
			evtTitle = event.Title
		}
		events = append(events, gin.H{
			"eventId":        reg.EventID,
			"eventName":      evtTitle,
			"status":         reg.Status,
			"checkingStatus": reg.CheckingStatus,
		})
	}

	c.JSON(http.StatusOK, gin.H{"events": events})
}
