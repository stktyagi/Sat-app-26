package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/store"
)

// PostSession is called once after Google sign-in. It verifies the ID token via
// the auth middleware and makes sure a user document exists, creating one that
// matches the shape of the existing records.
//
// The host-vs-external split is decided here from the email domain, because it
// drives both event pricing and the sameCollegeOnly gate.
func (a *API) PostSession(c *gin.Context) {
	ctx := c.Request.Context()
	tok := middleware.Token(c)
	if tok == nil {
		apierr.Respond(c, apierr.Unauthorized("missing_token", "authorization header required"))
		return
	}

	isHost := models.IsHostEmail(tok.Email, a.Cfg.HostEmailDomain)

	if u := middleware.CurrentUser(c); u != nil {
		// Existing user. Refresh only the fields Google owns, and never
		// overwrite a display name the user has since edited.
		patch := map[string]any{
			"email":                tok.Email,
			"isHostCollegeStudent": isHost,
		}
		if u.PhotoURL == "" && tok.PhotoURL != "" {
			patch["photoURL"] = tok.PhotoURL
		}
		if u.DisplayName == "" && tok.Name != "" {
			patch["displayName"] = tok.Name
		}

		updated, err := a.Store.UpdateUser(ctx, u.UserID, patch)
		if err != nil {
			apierr.Respond(c, apierr.Internal("could not update the profile"))
			return
		}
		c.JSON(http.StatusOK, gin.H{"user": updated, "created": false})
		return
	}

	created, err := a.Store.CreateUser(ctx, tok.UID, map[string]any{
		"email":                tok.Email,
		"displayName":          tok.Name,
		"photoURL":             tok.PhotoURL,
		"isHostCollegeStudent": isHost,
		"collegeName":          hostCollegeName(isHost),
		"referralCode":         models.RandomCode(6),
	})
	if err != nil {
		if errors.Is(err, store.ErrExists) {
			apierr.Respond(c, apierr.Conflict("user_exists", "profile already exists"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not create the profile"))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"user": created, "created": true})
}

func hostCollegeName(isHost bool) string {
	if isHost {
		return "Thapar Institute of Engineering and Technology"
	}
	return ""
}
