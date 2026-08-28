package apierr

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Error is the single error type every handler returns. Respond turns it into
// a consistent envelope so the Expo client only ever parses one shape.
type Error struct {
	Status  int    `json:"-"`
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

func (e *Error) Error() string { return e.Message }

func (e *Error) WithDetails(d any) *Error {
	e.Details = d
	return e
}

func New(status int, code, msg string) *Error {
	return &Error{Status: status, Code: code, Message: msg}
}

func BadRequest(code, msg string) *Error   { return New(http.StatusBadRequest, code, msg) }
func Unauthorized(code, msg string) *Error { return New(http.StatusUnauthorized, code, msg) }
func Forbidden(code, msg string) *Error    { return New(http.StatusForbidden, code, msg) }
func NotFound(code, msg string) *Error     { return New(http.StatusNotFound, code, msg) }
func Conflict(code, msg string) *Error     { return New(http.StatusConflict, code, msg) }
func PaymentRequired(code, msg string) *Error {
	return New(http.StatusPaymentRequired, code, msg)
}
func Internal(msg string) *Error { return New(http.StatusInternalServerError, "internal_error", msg) }

// Respond writes err as JSON. Unknown errors collapse to a 500 without leaking
// the underlying message to the client.
func Respond(c *gin.Context, err error) {
	var e *Error
	if !errors.As(err, &e) {
		c.Error(err) //nolint:errcheck // recorded for the logger
		e = Internal("something went wrong")
	}
	c.AbortWithStatusJSON(e.Status, gin.H{"error": e})
}
