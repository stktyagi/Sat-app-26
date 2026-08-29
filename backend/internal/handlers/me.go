package handlers

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
)

var phonePattern = regexp.MustCompile(`^[0-9]{7,15}$`)

func (a *API) GetMe(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"user": middleware.CurrentUser(c)})
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
// until name, phone, roll number and college are all present, at which point
// fullyRegistered flips to true.
//
// isHostCollegeStudent is deliberately not settable here: it is derived from
// the verified email domain, and it decides pricing.
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
		// The live data holds male, Male, Female and female; normalise on write
		// so new records are at least internally consistent.
		fields["gender"] = strings.ToLower(strings.TrimSpace(*body.Gender))
	}
	if body.Age != nil {
		fields["age"] = strings.TrimSpace(*body.Age)
	}
	if body.GraduationYear != nil {
		// Stored as a string. Some legacy documents hold a number instead,
		// which the coercion layer flattens on read.
		fields["graduationYear"] = strings.TrimSpace(*body.GraduationYear)
	}
	if body.Interests != nil {
		fields["interests"] = *body.Interests
	}
	if body.AccommodationNeeded != nil {
		fields["accommodationNeeded"] = *body.AccommodationNeeded
	}
	if body.ReferredBy != nil {
		fields["referredBy"] = strings.TrimSpace(*body.ReferredBy)
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
	complete := merged("displayName", user.DisplayName) != "" &&
		merged("phoneNumber", user.PhoneNumber) != "" &&
		merged("rollNumber", user.RollNumber) != "" &&
		merged("collegeName", user.CollegeName) != ""
	fields["fullyRegistered"] = complete

	updated, err := a.Store.UpdateUser(c.Request.Context(), user.UserID, fields)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not update the profile"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": updated})
}
