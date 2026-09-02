package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/random"
	"backend/internal/store"
)

// PostSession is called once after Google sign-in and makes sure a profile
// document exists.
//
// It stores nothing that can be derived: the host-vs-external split comes from
// the email domain on every request, and the avatar is generated client-side
// from the userId, so neither is written here.
func (a *API) PostSession(c *gin.Context) {
	ctx := c.Request.Context()
	tok := middleware.Token(c)
	if tok == nil {
		apierr.Respond(c, apierr.Unauthorized("missing_token", "authorization header required"))
		return
	}

	if u := middleware.CurrentUser(c); u != nil {
		// Existing user. Refresh only what Google owns, and never overwrite a
		// display name the user has since edited.
		patch := map[string]any{"email": tok.Email}
		if u.DisplayName == "" && tok.Name != "" {
			patch["displayName"] = tok.Name
		}

		updated, err := a.Store.UpdateUser(ctx, u.UserID, patch)
		if err != nil {
			apierr.Respond(c, apierr.Internal("could not update the profile"))
			return
		}
		c.JSON(http.StatusOK, gin.H{"user": updated.ResolveHostStatus(a.Cfg.HostEmailDomain), "created": false})
		return
	}

	seed := models.NewUser(tok.UID, tok.Email, tok.Name, random.Code(6))
	created, err := a.Store.CreateUser(ctx, seed)
	if err != nil {
		if errors.Is(err, store.ErrExists) {
			apierr.Respond(c, apierr.Conflict("user_exists", "profile already exists"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not create the profile"))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"user": created.ResolveHostStatus(a.Cfg.HostEmailDomain), "created": true})
}
