package handlers

import (
	"errors"
	"log"
	"net/http"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/store"
)

// adminUserPatch is the shape an admin uses to edit a user profile. Pointers
// distinguish an omitted field from one deliberately cleared, which is what
// PATCH needs.
type adminUserPatch struct {
	DisplayName         *string   `json:"displayName"`
	PhoneNumber         *string   `json:"phoneNumber"`
	RollNumber          *string   `json:"rollNumber"`
	CollegeName         *string   `json:"collegeName"`
	Gender              *string   `json:"gender"`
	Age                 *string   `json:"age"`
	GraduationYear      *string   `json:"graduationYear"`
	Interests           *[]string `json:"interests"`
	AccommodationNeeded *bool     `json:"accommodationNeeded"`
	Roles               *[]string `json:"roles"`
	IsVerified          *bool     `json:"isVerified"`
	IsAmbassador        *bool     `json:"isAmbassador"`
	ReferralCode        *string   `json:"referralCode"`
	ReferredBy          *string   `json:"referredBy"`
	Coins               *int      `json:"coins"`
}

// AdminGetUser resolves a user by their unique email and returns the full
// profile. Email is the lookup key because it is unique per account.
func (a *API) AdminGetUser(c *gin.Context) {
	ctx := c.Request.Context()
	email := c.Param("email")
	if email == "" {
		apierr.Respond(c, apierr.BadRequest("missing_email", "email is required"))
		return
	}

	user, err := a.Store.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Respond(c, apierr.NotFound("user_not_found", "no user with that email"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not load user"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user.ResolveHostStatus(a.Cfg.HostEmailDomain)})
}

// AdminGetUserByID resolves a user by their unique ID and returns the full profile.
func (a *API) AdminGetUserByID(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")
	if id == "" {
		apierr.Respond(c, apierr.BadRequest("missing_id", "id is required"))
		return
	}

	user, err := a.Store.GetUser(ctx, id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Respond(c, apierr.NotFound("user_not_found", "no user with that ID"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not load user"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user.ResolveHostStatus(a.Cfg.HostEmailDomain)})
}

// AdminUpdateUser applies a partial update to a user profile. Admins can edit
// fields a regular user cannot, including roles, verification status and coins.
func (a *API) AdminUpdateUser(c *gin.Context) {
	ctx := c.Request.Context()
	email := c.Param("email")
	if email == "" {
		apierr.Respond(c, apierr.BadRequest("missing_email", "email is required"))
		return
	}

	var body adminUserPatch
	if !bind(c, &body) {
		return
	}

	fields := map[string]any{}

	if body.DisplayName != nil {
		v := strings.TrimSpace(*body.DisplayName)
		if v == "" {
			apierr.Respond(c, apierr.BadRequest("invalid_display_name", "displayName cannot be empty"))
			return
		}
		fields["displayName"] = v
	}
	if body.PhoneNumber != nil {
		fields["phoneNumber"] = strings.TrimSpace(*body.PhoneNumber)
	}
	if body.RollNumber != nil {
		fields["rollNumber"] = strings.TrimSpace(*body.RollNumber)
	}
	if body.CollegeName != nil {
		fields["collegeName"] = strings.TrimSpace(*body.CollegeName)
	}
	if body.Gender != nil {
		fields["gender"] = strings.ToLower(strings.TrimSpace(*body.Gender))
	}
	if body.Age != nil {
		fields["age"] = strings.TrimSpace(*body.Age)
	}
	if body.GraduationYear != nil {
		fields["graduationYear"] = strings.TrimSpace(*body.GraduationYear)
	}
	if body.Interests != nil {
		fields["interests"] = *body.Interests
	}
	if body.AccommodationNeeded != nil {
		fields["accommodationNeeded"] = *body.AccommodationNeeded
	}
	if body.Roles != nil {
		caller := middleware.CurrentUser(c)
		if caller == nil || !caller.IsAdmin() {
			apierr.Respond(c, apierr.Forbidden("admin_only", "only administrators can modify user roles"))
			return
		}
		cleaned := make([]string, 0, len(*body.Roles))
		hasUser := false
		for _, r := range *body.Roles {
			norm := models.NormalizeRole(r)
			if norm != "" && !slices.Contains(cleaned, norm) {
				cleaned = append(cleaned, norm)
				if norm == models.RoleUser {
					hasUser = true
				}
			}
		}
		if !hasUser {
			cleaned = append(cleaned, models.RoleUser)
		}
		fields["roles"] = cleaned
	}
	if body.IsVerified != nil {
		fields["isVerified"] = *body.IsVerified
	}
	if body.IsAmbassador != nil {
		fields["isAmbassador"] = *body.IsAmbassador
	}
	if body.ReferralCode != nil {
		fields["referralCode"] = strings.TrimSpace(*body.ReferralCode)
	}
	if body.ReferredBy != nil {
		fields["referredBy"] = strings.TrimSpace(*body.ReferredBy)
	}
	if body.Coins != nil {
		fields["coins"] = *body.Coins
	}

	if len(fields) == 0 {
		apierr.Respond(c, apierr.BadRequest("empty_patch", "no updatable fields supplied"))
		return
	}

	// Resolve email to uid, then update by uid.
	user, err := a.Store.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Respond(c, apierr.NotFound("user_not_found", "no user with that email"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not load user"))
		return
	}

	updated, err := a.Store.UpdateUser(ctx, user.UserID, fields)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not update user"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": updated.ResolveHostStatus(a.Cfg.HostEmailDomain)})
}

// AdminDeleteUser removes a user document and all associated registrations.
// This is an irreversible operation.
func (a *API) AdminDeleteUser(c *gin.Context) {
	ctx := c.Request.Context()
	email := c.Param("email")
	if email == "" {
		apierr.Respond(c, apierr.BadRequest("missing_email", "email is required"))
		return
	}

	// Resolve email to uid before deleting.
	user, err := a.Store.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Respond(c, apierr.NotFound("user_not_found", "no user with that email"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not load user"))
		return
	}

	if err := a.Clients.DeleteUserFromAuth(ctx, user.UserID); err != nil {
		// Log the error but proceed with deleting the user document.
		// Often the user is already deleted from Auth, but we still need to delete them from Firestore.
		log.Printf("Warning: failed to delete user %s from auth: %v", user.UserID, err)
	}

	if err := a.Store.DeleteUser(ctx, user.UserID); err != nil {
		apierr.Respond(c, apierr.Internal("could not delete user document"))
		return
	}

	c.Status(http.StatusNoContent)
}

// AdminGetUserEvents lists everything a given user is registered for, similar to GetMyEvents.
func (a *API) AdminGetUserEvents(c *gin.Context) {
	ctx := c.Request.Context()
	email := c.Param("email")
	if email == "" {
		apierr.Respond(c, apierr.BadRequest("missing_email", "email parameter is required"))
		return
	}

	user, err := a.Store.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Respond(c, apierr.NotFound("user_not_found", "no user found with that email"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not lookup user"))
		return
	}

	regs, err := a.Store.ListUserRegistrations(ctx, user.UserID)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load registrations"))
		return
	}

	items := make([]gin.H, 0, len(regs))
	for _, reg := range regs {
		reg.QRToken = a.QR.Sign(reg.ID)
		row := gin.H{"registration": reg}

		if event, err := a.Cache.Get(ctx, reg.EventID); err == nil {
			fee := event.FeeFor(user.IsHostCollegeStudent)
			event.EffectiveFee = &fee
			row["event"] = event
		}
		
		if reg.TeamID != "" {
			if team, err := a.Store.GetTeam(ctx, reg.TeamID); err == nil {
				a.hydrateMembers(ctx, team)
				row["team"] = team
			}
		}

		items = append(items, row)
	}

	c.JSON(http.StatusOK, gin.H{"items": items})
}