package handlers

import (
	"context"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
)

var phonePattern = regexp.MustCompile(`^[0-9]{7,15}$`)

func (a *API) GetMe(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user != nil && user.AccommodationTier == "" {
		tier := a.resolveUserAccommodationTier(c.Request.Context(), user.UserID)
		if updated, err := a.Store.UpdateUser(c.Request.Context(), user.UserID, map[string]any{
			"accommodationTier": tier,
		}); err == nil && updated != nil {
			user = updated.ResolveHostStatus(a.Cfg.HostEmailDomain)
		} else {
			user.AccommodationTier = tier
		}
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

// resolveUserAccommodationTier checks existing event registrations for a user.
// If any registration is for a Technical event, it returns "technical".
// Otherwise, it returns the default "cultural".
func (a *API) resolveUserAccommodationTier(ctx context.Context, userID string) string {
	if a.Store == nil || userID == "" {
		return models.AccommodationTierCultural
	}
	regs, err := a.Store.ListUserRegistrations(ctx, userID)
	if err == nil {
		for _, r := range regs {
			if r.EventID == "" {
				continue
			}
			var category string
			if a.Cache != nil {
				if ev, err := a.Cache.Get(ctx, r.EventID); err == nil && ev != nil {
					category = ev.Category
				}
			}
			if category == "" {
				if ev, err := a.Store.GetEvent(ctx, r.EventID); err == nil && ev != nil {
					category = ev.Category
				}
			}
			if strings.EqualFold(category, "Technical") {
				return models.AccommodationTierTechnical
			}
		}
	}
	return models.AccommodationTierCultural
}

// profilePatch uses pointers so an omitted field is distinguishable from one
// deliberately cleared.
type profilePatch struct {
	DisplayName         *string   `json:"displayName"`
	PhoneNumber         *string   `json:"phoneNumber"`
	RollNumber          *string   `json:"rollNumber"`
	CollegeName         *string   `json:"collegeName"`
	Gender              *string   `json:"gender"`
	Age                 *string   `json:"age"`
	GraduationYear      *string   `json:"graduationYear"`
	Interests           *[]string `json:"interests"`
	AccommodationNeeded *bool     `json:"accommodationNeeded"`
	ReferredBy          *string   `json:"referredBy"`
}

// PatchMe completes or edits the profile. Registration endpoints stay blocked
// until phone, roll number and college are all present, at which point
// fullyRegistered flips to true.
//
// Neither roles nor the host-college flag are settable here: the first is
// admin-controlled, the second is derived from the verified email domain.
func (a *API) PatchMe(c *gin.Context) {
	var body profilePatch
	if !bind(c, &body) {
		return
	}

	user := middleware.CurrentUser(c)
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
		v := strings.TrimSpace(*body.PhoneNumber)
		if !phonePattern.MatchString(v) {
			apierr.Respond(c, apierr.BadRequest("invalid_phone", "phoneNumber must be 7 to 15 digits"))
			return
		}
		fields["phoneNumber"] = v
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
		hasBookedAcc := false
		if user != nil {
			for _, booked := range user.Accommodation {
				if booked {
					hasBookedAcc = true
					break
				}
			}
		}
		if hasBookedAcc && !*body.AccommodationNeeded {
			fields["accommodationNeeded"] = true
		} else {
			fields["accommodationNeeded"] = *body.AccommodationNeeded
		}
	}
	if body.ReferredBy != nil {
		refCode := strings.TrimSpace(*body.ReferredBy)
		if refCode != "" && user != nil && user.ReferredBy == "" && !strings.EqualFold(refCode, user.ReferralCode) {
			referrer, err := a.Store.GetUserByReferralCode(c.Request.Context(), refCode)
			if err == nil && referrer != nil && referrer.UserID != user.UserID {
				fields["referredBy"] = refCode
				// Reward referrer with 100 coins
				go func(refUserID string) {
					_, _ = a.Store.AddCoins(context.Background(), refUserID, 100)
				}(referrer.UserID)
				// Reward current user with 50 coins
				fields["coins"] = user.Coins + 50
			} else {
				fields["referredBy"] = refCode
			}
		} else if refCode != "" {
			fields["referredBy"] = refCode
		}
	}

	if len(fields) == 0 {
		apierr.Respond(c, apierr.BadRequest("empty_patch", "no updatable fields supplied"))
		return
	}

	// Decide completeness against the merged result, not the patch alone.
	merged := func(key, current string) string {
		if v, ok := fields[key].(string); ok {
			return v
		}
		return current
	}
	// displayName is optional: Apple/email sign-ins may not provide one and the
	// app never asks for it (App Review). Phone is collected at event registration.
	complete := merged("phoneNumber", user.PhoneNumber) != "" &&
		merged("rollNumber", user.RollNumber) != "" &&
		merged("collegeName", user.CollegeName) != ""
	fields["fullyRegistered"] = complete

	updated, err := a.Store.UpdateUser(c.Request.Context(), user.UserID, fields)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not update the profile"))
		return
	}
	updated.IsHostCollegeStudent = user.IsHostCollegeStudent

	c.JSON(http.StatusOK, gin.H{"user": updated})
}

type gameCompleteBody struct {
	Game string `json:"game"`
}

// ClaimDailyGameCoins handles awarding daily coins when completing games on the frontend.
func (a *API) ClaimDailyGameCoins(c *gin.Context) {
	var body gameCompleteBody
	if !bind(c, &body) {
		return
	}

	game := strings.ToLower(strings.TrimSpace(body.Game))
	if game == "" {
		game = "zip"
	}

	user := middleware.CurrentUser(c)
	if user == nil {
		apierr.Respond(c, apierr.Unauthorized("not_authenticated", "login required"))
		return
	}

	reward := 20
	newCoins, awarded, alreadyClaimed, err := a.Store.ClaimDailyGame(c.Request.Context(), user.UserID, game, reward)
	if err != nil {
		log.Printf("ClaimDailyGameCoins error for user %s, game %s: %v", user.UserID, game, err)
		apierr.Respond(c, apierr.Internal("failed to award game coins"))
		return
	}

	msg := "You earned 20 Saturnalia Coins!"
	if alreadyClaimed {
		msg = "You have already claimed today's coins for this game. Come back tomorrow!"
	}

	c.JSON(http.StatusOK, gin.H{
		"success":        !alreadyClaimed,
		"alreadyClaimed": alreadyClaimed,
		"coins":          newCoins,
		"awarded":        awarded,
		"message":        msg,
	})
}

// maxIdentityImage caps the face photo and ID card uploads. Phone photos are a
// few MB; anything past this is not a picture of a card.
const maxIdentityImage = 5 << 20

// uploadMine stores an image the caller supplies about themselves (face photo,
// college ID) and records it on their profile under refField/urlField. The
// file it replaces is deleted once the profile points at the new one.
func (a *API) uploadMine(refField, urlField, folder string, current func(*models.User) string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if a.Storage == nil {
			apierr.Respond(c, apierr.BadRequest("storage_not_configured", "ImageKit storage is not configured"))
			return
		}

		fh, err := c.FormFile("file")
		if err != nil {
			apierr.Respond(c, apierr.BadRequest("missing_file", "an image file is required"))
			return
		}
		if fh.Size > maxIdentityImage {
			apierr.Respond(c, apierr.BadRequest("file_too_large", "image must be 5 MB or smaller"))
			return
		}
		f, err := fh.Open()
		if err != nil {
			apierr.Respond(c, apierr.BadRequest("file_read_error", err.Error()))
			return
		}
		defer f.Close()

		// Sniffed from the bytes, not taken from the client's Content-Type.
		head := make([]byte, 512)
		n, _ := io.ReadFull(f, head)
		if !strings.HasPrefix(http.DetectContentType(head[:n]), "image/") {
			apierr.Respond(c, apierr.BadRequest("not_an_image", "file must be an image"))
			return
		}
		if _, err := f.Seek(0, io.SeekStart); err != nil {
			apierr.Respond(c, apierr.Internal("could not read the upload"))
			return
		}

		user := middleware.CurrentUser(c)
		ref, url, err := a.Storage.UploadFile(c.Request.Context(), folder, user.UserID, f)
		if err != nil {
			log.Printf("uploadMine(%s) for %s: %v", folder, user.UserID, err)
			apierr.Respond(c, apierr.Internal("failed to upload image"))
			return
		}

		saved := false
		defer func() { a.settleMedia(saved, []string{current(user)}, []string{ref}) }()

		updated, err := a.Store.UpdateUser(c.Request.Context(), user.UserID, map[string]any{refField: ref, urlField: url})
		if err != nil {
			apierr.Respond(c, apierr.Internal("could not update the profile"))
			return
		}
		saved = true
		updated.IsHostCollegeStudent = user.IsHostCollegeStudent

		c.JSON(http.StatusOK, gin.H{"user": updated})
	}
}
