package handlers

import (
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
	updated.IsHostCollegeStudent = user.IsHostCollegeStudent

	c.JSON(http.StatusOK, gin.H{"user": updated})
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
