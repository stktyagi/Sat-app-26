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
	Category string `json:"category"` // "gate" | "hostel" | "desk" | "event"
}

type gateCheckInRequest struct {
	UserID *string `json:"userId"`
	Fest   *bool   `json:"fest"`
	Remark *string `json:"remark"`
}

type hostelCheckInRequest struct {
	UserID        *string             `json:"userId"`
	Accommodation *bool               `json:"accommodation"`
	CheckedOut    *bool               `json:"checkedOut"`
	Action        *string             `json:"action"` // "checkin" | "checkout" | "undo_checkout" | "revert"
	Hostel        *string             `json:"hostel"`
	RoomNo        *string             `json:"roomNo"`
	RoomNoAlt     *string             `json:"RoomNo"`
	Items         *models.HostelItems `json:"items"`
}

type eventCheckInRequest struct {
	RegistrationID *string `json:"registrationId"`
	Status         *string `json:"status"` // "checked-in" | "checked in" | "rejected" | "pending"
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
	switch category {
	case "gate", "hostel", "desk":
		if caller != nil && !caller.IsHospitality() {
			apierr.Respond(c, apierr.Forbidden("insufficient_permissions", "hospitality role required for gate, desk and hostel scanning"))
			return
		}
	case "event":
	default:
		apierr.Respond(c, apierr.BadRequest("invalid_category", "category must be gate, hostel, desk or event"))
		return
	}
	if category == "event" {
		if caller != nil && !caller.IsAdmin() && !caller.HasRole(models.RoleEBEvents) && !caller.HasRole(models.RoleEventPOC) && !caller.HasRole(models.RoleCoreHospitality) {
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
	var candidateRegs []*models.Registration

	// 1. Try verifying as signed QR token
	if regID, verifyErr := a.QR.Verify(rawData); verifyErr == nil && regID != "" {
		reg, err = a.Store.GetRegistration(ctx, regID)
		if reg != nil {
			candidateRegs = []*models.Registration{reg}
		}
	}

	// 2. Try rawData directly as registration ID
	if reg == nil {
		reg, err = a.Store.GetRegistration(ctx, rawData)
		if reg != nil {
			candidateRegs = []*models.Registration{reg}
		}
	}

	// 3. If rawData has eventId_userId format, try directly
	if reg == nil && strings.Contains(rawData, "_") {
		reg, err = a.Store.GetRegistration(ctx, rawData)
		if reg != nil {
			candidateRegs = []*models.Registration{reg}
		}
	}

	// 4. If rawData is a userId, check if user has registrations
	if reg == nil {
		if regs, listErr := a.Store.ListUserRegistrations(ctx, rawData); listErr == nil && len(regs) > 0 {
			candidateRegs = regs
			caller := middleware.CurrentUser(c)
			// Prioritize coordinator's assigned event if applicable
			if caller != nil && !caller.IsAdmin() && !caller.HasRole(models.RoleEBEvents) {
				for _, r := range regs {
					evt, _ := a.Cache.Get(ctx, r.EventID)
					if isUserEventCoordinator(caller, evt) {
						reg = r
						err = nil
						break
					}
				}
			}
			if reg == nil {
				reg = regs[0]
				err = nil
			}
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
	photoURL := ""
	collegeIDURL := ""
	if u != nil {
		if u.DisplayName != "" {
			userName = u.DisplayName
		}
		userEmail = u.Email
		userPhone = u.PhoneNumber
		photoURL = u.PhotoURL
		collegeIDURL = u.CollegeIDURL
	}

	chkStatus := models.NormalizeCheckinStatus(reg.CheckingStatus)

	resolveReg := func(r *models.Registration) {
		if r == nil || r.Status == models.RegStatusRejected {
			return
		}
		isTeamComplete := true
		isPaid := true
		if evt != nil && evt.PaymentRequired {
			isPaid = r.PaymentStatus == models.RegPaymentSuccess
		}
		if r.TeamID != "" {
			if t, err := a.Store.GetTeam(ctx, r.TeamID); err == nil && t != nil {
				minSize := 1
				if evt != nil && evt.MinTeamSize > 0 {
					minSize = evt.MinTeamSize
				}
				isTeamComplete = t.Size >= minSize
				if evt != nil && evt.PaymentRequired {
					isPaid = t.Paid
				}
			}
		}
		r.Status = models.ResolveRegistrationStatus(isTeamComplete, isPaid, r.Status)
	}
	resolveReg(reg)
	for _, cr := range candidateRegs {
		resolveReg(cr)
	}

	// Build full candidate registrations list for multi-event attendee support
	allRegsData := make([]gin.H, 0, len(candidateRegs))
	for _, cr := range candidateRegs {
		crTitle := "Event"
		if crEvt, _ := a.Cache.Get(ctx, cr.EventID); crEvt != nil && crEvt.Title != "" {
			crTitle = crEvt.Title
		}
		crStatus := models.NormalizeCheckinStatus(cr.CheckingStatus)
		allRegsData = append(allRegsData, gin.H{
			"registrationId": cr.ID,
			"eventId":        cr.EventID,
			"eventName":      crTitle,
			"status":         cr.Status,
			"checkingStatus": crStatus,
			"paymentStatus":  cr.PaymentStatus,
			"teamId":         cr.TeamID,
		})
	}

	a.LogAuditTarget("qr_scan_event", "qr_scanner", caller, &models.AuditTarget{
		UserID: reg.UserID,
		Name:   userName,
		Email:  userEmail,
		Phone:  userPhone,
	}, map[string]any{
		"category":       "event",
		"registrationId": reg.ID,
		"eventId":        reg.EventID,
		"eventName":      eventName,
		"checkingStatus": chkStatus,
		"paymentStatus":  reg.PaymentStatus,
	})

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
			"photoUrl":       photoURL,
			"collegeIdUrl":   collegeIDURL,
			"status":         reg.Status,
			"checkingStatus": chkStatus,
			"paymentStatus":  reg.PaymentStatus,
			"teamId":         reg.TeamID,
		},
		"hasMultiple":      len(candidateRegs) > 1,
		"allRegistrations": allRegsData,
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
			"checkingStatus": models.NormalizeCheckinStatus(r.CheckingStatus),
		})
	}

	resolvedUser := user.ResolveHostStatus(a.Cfg.HostEmailDomain)

	data := gin.H{
		"userId":               user.UserID,
		"displayName":          user.DisplayName,
		"name":                 user.DisplayName,
		"email":                user.Email,
		"phoneNumber":          user.PhoneNumber,
		"collegeName":          user.CollegeName,
		"gender":               user.Gender,
		"rollNumber":           user.RollNumber,
		"photoUrl":             user.PhotoURL,
		"collegeIdUrl":         user.CollegeIDURL,
		"isHostCollegeStudent": resolvedUser.IsHostCollegeStudent,
		"accommodationNeeded":  user.AccommodationNeeded,
		"accommodation":        user.Accommodation,
		"food":                 user.Food,
		"checkInStatus":        checkInStatusJSON(user.CheckInStatus),
		"userEvents":           eventsList,
	}

	if category == "desk" {
		data["rollNumber"] = user.RollNumber
		data["photoUrl"] = user.PhotoURL
		data["collegeIdUrl"] = user.CollegeIDURL
		data["accommodationTier"] = user.AccommodationTier
		data["age"] = user.Age
		hostels, err := a.Store.ListHostels(ctx)
		if err != nil {
			hostels = nil
		}
		list := make([]gin.H, 0, len(hostels))
		for _, h := range hostels {
			if !h.Active || !h.AcceptsGender(user.Gender) {
				continue
			}
			list = append(list, hostelJSON(h))
		}
		data["hostels"] = list
	}

	caller := middleware.CurrentUser(c)
	a.LogAudit("qr_scan_"+category, "qr_scanner", caller, user, map[string]any{
		"category":      category,
		"gateStatus":    user.CheckInStatus.Fest,
		"hostel":        user.CheckInStatus.Hostel,
		"roomNo":        user.CheckInStatus.RoomNo,
		"accommodation": user.CheckInStatus.Accommodation,
	})

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"category": category,
		"data":     data,
	})
}

func checkInStatusJSON(st models.CheckInStatus) gin.H {
	return gin.H{
		"fest":          st.Fest,
		"remark":        st.Remark,
		"gateAt":        st.GateAt,
		"accommodation": st.Accommodation,
		"checkedOut":    st.CheckedOut,
		"checkedOutAt":  st.CheckedOutAt,
		"checkedInAt":   st.CheckedInAt,
		"allottedAt":    st.AllottedAt,
		"allottedBy":    st.AllottedBy,
		"Hostel":        st.Hostel,
		"RoomNo":        st.RoomNo,
		"items":         st.Items,
	}
}

// AdminGateCheckIn updates gate entry and remark for a user. Reverting an
// entry (fest true -> false) is restricted to EB/EC hospitality.
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
	if u.CheckInStatus.Fest && !festStatus {
		if caller := middleware.CurrentUser(c); !caller.IsHospitalityLead() {
			apierr.Respond(c, apierr.Forbidden("lead_required", "only EB/EC hospitality can revert a gate check-in"))
			return
		}
	}

	remark := u.CheckInStatus.Remark
	if req.Remark != nil {
		remark = strings.TrimSpace(*req.Remark)
	}

	updatedUser, err := a.Store.SetGateStatus(ctx, uid, festStatus, remark)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not update gate check-in status"))
		return
	}

	caller := middleware.CurrentUser(c)
	actionName := "gate_checkin"
	if u.CheckInStatus.Fest && !festStatus {
		actionName = "revert_gate"
	}
	a.LogAudit(actionName, "hospitality", caller, updatedUser, map[string]any{
		"fest":           festStatus,
		"previousFest":   u.CheckInStatus.Fest,
		"remark":         remark,
		"previousRemark": u.CheckInStatus.Remark,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Gate entry updated successfully",
		"data": gin.H{
			"userId":        updatedUser.UserID,
			"checkInStatus": checkInStatusJSON(updatedUser.CheckInStatus),
		},
	})
}

// respondHostelErr maps hostel store errors to API errors.
func respondHostelErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		apierr.Respond(c, apierr.NotFound("not_found", "user or hostel not found"))
	case errors.Is(err, store.ErrHostelFull):
		apierr.Respond(c, apierr.Conflict("hostel_full", "this hostel is full"))
	case errors.Is(err, store.ErrHostelGender):
		apierr.Respond(c, apierr.BadRequest("hostel_gender_mismatch", "this hostel does not accept the participant's gender"))
	case errors.Is(err, store.ErrHostelInactive):
		apierr.Respond(c, apierr.BadRequest("hostel_inactive", "this hostel is not active"))
	case errors.Is(err, store.ErrNotAllotted):
		apierr.Respond(c, apierr.Conflict("not_allotted", "no hostel allotted yet - send to registration desk"))
	case errors.Is(err, store.ErrCapacityBelowUsed):
		apierr.Respond(c, apierr.BadRequest("capacity_below_occupied", "capacity cannot be lower than current occupancy"))
	default:
		apierr.Respond(c, apierr.Internal("could not update accommodation status"))
	}
}

// resolveHostelAction turns the request (explicit action or legacy booleans)
// into a store action.
func resolveHostelAction(req hostelCheckInRequest, cur models.CheckInStatus) string {
	if req.Action != nil && strings.TrimSpace(*req.Action) != "" {
		return strings.ToLower(strings.TrimSpace(*req.Action))
	}
	if req.Accommodation != nil && !*req.Accommodation {
		return store.HostelActionRevert
	}
	if req.CheckedOut != nil {
		if *req.CheckedOut {
			return store.HostelActionCheckOut
		}
		if cur.CheckedOut {
			return store.HostelActionUndoCheckOut
		}
	}
	if req.Accommodation != nil && *req.Accommodation {
		return store.HostelActionCheckIn
	}
	return store.HostelActionItems
}

// AdminHostelCheckIn updates accommodation check-in status, bedding items and
// keeps the hostel occupancy counters in step.
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

	caller := middleware.CurrentUser(c)
	action := resolveHostelAction(req, u.CheckInStatus)
	switch action {
	case store.HostelActionCheckIn, store.HostelActionCheckOut, store.HostelActionUndoCheckOut, store.HostelActionItems:
	case store.HostelActionRevert:
		if !caller.IsHospitalityLead() {
			apierr.Respond(c, apierr.Forbidden("lead_required", "only EB/EC hospitality can revert a hostel check-in"))
			return
		}
	default:
		apierr.Respond(c, apierr.BadRequest("invalid_action", "action must be checkin, checkout, undo_checkout, revert or items"))
		return
	}

	roomNo := req.RoomNo
	if roomNo == nil {
		roomNo = req.RoomNoAlt
	}

	// A hostel in the body that differs from the current allotment is a
	// (re-)allotment, which moves the counters.
	if action != store.HostelActionRevert && req.Hostel != nil {
		if h := strings.TrimSpace(*req.Hostel); h != "" && h != u.CheckInStatus.Hostel {
			room := u.CheckInStatus.RoomNo
			if roomNo != nil {
				room = strings.TrimSpace(*roomNo)
			}
			if _, err := a.Store.AllotHostel(ctx, uid, h, room, callerID(caller)); err != nil {
				respondHostelErr(c, err)
				return
			}
		}
	}

	updatedUser, err := a.Store.ApplyHostelAction(ctx, uid, store.HostelActionInput{
		Action: action,
		RoomNo: roomNo,
		Items:  req.Items,
	})
	if err != nil {
		respondHostelErr(c, err)
		return
	}

	actionName := "hostel_" + action
	if action == store.HostelActionRevert {
		actionName = "revert_hostel"
	} else if action == store.HostelActionCheckIn {
		actionName = "hostel_checkin"
	} else if action == store.HostelActionCheckOut {
		actionName = "hostel_checkout"
	}
	a.LogAudit(actionName, "hospitality", caller, updatedUser, map[string]any{
		"action":         action,
		"hostel":         updatedUser.CheckInStatus.Hostel,
		"roomNo":         updatedUser.CheckInStatus.RoomNo,
		"previousHostel": u.CheckInStatus.Hostel,
		"previousRoomNo": u.CheckInStatus.RoomNo,
		"items":          req.Items,
		"unreturned":     updatedUser.CheckInStatus.Items.Unreturned(),
	})

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"message":    "Accommodation status updated successfully",
		"unreturned": updatedUser.CheckInStatus.Items.Unreturned(),
		"data": gin.H{
			"userId":        updatedUser.UserID,
			"checkInStatus": checkInStatusJSON(updatedUser.CheckInStatus),
		},
	})
}

func callerID(u *models.User) string {
	if u == nil {
		return ""
	}
	if u.Email != "" {
		return u.Email
	}
	return u.UserID
}

// AdminEventCheckIn updates checkingStatus ("checked-in", "checked in", "rejected", "pending") on an event registration.
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

	status := models.CheckinDone
	if req.Status != nil && strings.TrimSpace(*req.Status) != "" {
		status = models.NormalizeCheckinStatus(*req.Status)
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

	u, _ := a.Store.GetUser(ctx, reg.UserID)
	evt, _ := a.Cache.Get(ctx, reg.EventID)
	evtTitle := reg.EventID
	if evt != nil && evt.Title != "" {
		evtTitle = evt.Title
	}
	a.LogAudit("event_checkin", "event", caller, u, map[string]any{
		"registrationId": reg.ID,
		"eventId":        reg.EventID,
		"eventName":      evtTitle,
		"checkingStatus": status,
		"previousStatus": reg.CheckingStatus,
	})

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
			"checkingStatus": models.NormalizeCheckinStatus(reg.CheckingStatus),
		})
	}

	c.JSON(http.StatusOK, gin.H{"events": events})
}
