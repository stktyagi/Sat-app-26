package middleware

import (
	"log"
	"net/http"
	"slices"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"backend/internal/apierr"
)

// WithRequestID stamps every request so a client-reported failure can be found
// in the logs.
func WithRequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader("X-Request-ID")
		if id == "" {
			id = uuid.NewString()
		}
		c.Set(ctxReqID, id)
		c.Header("X-Request-ID", id)
		c.Next()
	}
}

// Recovery converts a panic into the same JSON error envelope every other
// failure uses, rather than an empty 500 with a stack trace on the wire.
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("panic [%s] %s %s: %v", RequestID(c), c.Request.Method, c.Request.URL.Path, r)
				apierr.Respond(c, apierr.Internal("something went wrong"))
			}
		}()
		c.Next()
	}
}

// CORS allows the Expo dev server and any configured web origin. A single "*"
// entry disables origin checking, which is the default for local development.
func CORS(allowed []string) gin.HandlerFunc {
	allowAll := slices.Contains(allowed, "*")

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		switch {
		case allowAll:
			c.Header("Access-Control-Allow-Origin", "*")
		case origin != "" && slices.Contains(allowed, origin):
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		}
		c.Header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Request-ID")
		c.Header("Access-Control-Max-Age", "600")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
