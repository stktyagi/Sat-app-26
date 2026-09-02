package middleware

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/fb"
	"backend/internal/store"
)

// Auth verifies the Firebase ID token the app sends and, when one is present,
// loads the matching user document.
//
// When required is false the request continues unauthenticated if no token was
// supplied — that is what lets GET /events add per-user pricing for a signed-in
// caller while staying public. A token that is present but invalid is always an
// error, on every route.
func Auth(clients *fb.Clients, s *store.Store, hostDomain string, required bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := bearer(c)
		if raw == "" {
			if required {
				apierr.Respond(c, apierr.Unauthorized("missing_token", "authorization header required"))
				return
			}
			c.Next()
			return
		}

		tok, err := clients.Auth.VerifyIDToken(c.Request.Context(), raw)
		if err != nil {
			apierr.Respond(c, apierr.Unauthorized("invalid_token", "could not verify the ID token"))
			return
		}

		info := &TokenInfo{
			UID:   tok.UID,
			Email: claimString(tok.Claims, "email"),
			Name:  claimString(tok.Claims, "name"),
		}
		c.Set(ctxUID, tok.UID)
		c.Set(ctxToken, info)

		user, err := s.GetUser(c.Request.Context(), tok.UID)
		switch {
		case err == nil:
			// Host-vs-external is derived here, from the domain of the email on
			// the verified token, rather than read from a stored flag that could
			// disagree with it. It decides pricing and the sameCollegeOnly gate.
			c.Set(ctxUser, user.ResolveHostStatus(hostDomain))
		case errors.Is(err, store.ErrNotFound):
			// Authenticated but no profile document yet. POST /auth/session
			// creates it; RequireUser blocks everything else until then.
		default:
			apierr.Respond(c, apierr.Internal("could not load the user profile"))
			return
		}

		c.Next()
	}
}

// RequireUser rejects a caller whose user document does not exist yet.
func RequireUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		if CurrentUser(c) == nil {
			apierr.Respond(c, apierr.Unauthorized("no_profile", "call POST /api/v1/auth/session first"))
			return
		}
		c.Next()
	}
}

// RequireFullyRegistered gates every registration path on a completed profile,
// using the fullyRegistered flag the existing platform already maintains.
func RequireFullyRegistered() gin.HandlerFunc {
	return func(c *gin.Context) {
		u := CurrentUser(c)
		if u == nil {
			apierr.Respond(c, apierr.Unauthorized("no_profile", "call POST /api/v1/auth/session first"))
			return
		}
		if !u.FullyRegistered {
			apierr.Respond(c, apierr.Forbidden("profile_incomplete", "complete your profile with PATCH /api/v1/me before registering"))
			return
		}
		c.Next()
	}
}

// RequireAdmin guards event mutation. Roles are additive, so this is a
// membership test against the roles array rather than an equality check.
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		u := CurrentUser(c)
		if u == nil || !u.IsAdmin() {
			apierr.Respond(c, apierr.Forbidden("admin_only", "administrator access required"))
			return
		}
		c.Next()
	}
}

func bearer(c *gin.Context) string {
	h := c.GetHeader("Authorization")
	if h == "" {
		return ""
	}
	scheme, token, ok := strings.Cut(h, " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return strings.TrimSpace(token)
}

func claimString(claims map[string]any, key string) string {
	s, _ := claims[key].(string)
	return s
}
