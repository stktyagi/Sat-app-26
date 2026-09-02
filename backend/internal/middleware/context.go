package middleware

import (
	"github.com/gin-gonic/gin"

	"backend/internal/models"
)

const (
	ctxUID   = "auth.uid"
	ctxToken = "auth.token"
	ctxUser  = "auth.user"
	ctxReqID = "req.id"
)

// TokenInfo carries the claims taken straight off the verified Firebase ID
// token, which is all that is available before the user document is loaded.
type TokenInfo struct {
	UID   string
	Email string
	Name  string
}

func UID(c *gin.Context) string {
	v, _ := c.Get(ctxUID)
	s, _ := v.(string)
	return s
}

func Token(c *gin.Context) *TokenInfo {
	v, _ := c.Get(ctxToken)
	t, _ := v.(*TokenInfo)
	return t
}

// CurrentUser returns the loaded user document, or nil when the caller is
// anonymous or has authenticated but never called POST /auth/session.
func CurrentUser(c *gin.Context) *models.User {
	v, _ := c.Get(ctxUser)
	u, _ := v.(*models.User)
	return u
}

func RequestID(c *gin.Context) string {
	v, _ := c.Get(ctxReqID)
	s, _ := v.(string)
	return s
}
