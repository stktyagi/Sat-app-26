package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
)

type askBody struct {
	Message      string `json:"message"`
	SessionID    string `json:"sessionId"`
	SessionIDAlt string `json:"session_id"`
}

type resetBody struct {
	SessionID    string `json:"sessionId"`
	SessionIDAlt string `json:"session_id"`
}

// Chat handles AI-powered questions about Saturnalia'26 using the SatBot service.
func (a *API) Chat(c *gin.Context) {
	ctx := c.Request.Context()
	user := middleware.CurrentUser(c)

	var body askBody
	if c.Request.ContentLength > 0 && !bind(c, &body) {
		return
	}

	if body.Message == "" {
		apierr.Respond(c, apierr.BadRequest("empty_message", "message is required"))
		return
	}

	sessionID := body.SessionID
	if sessionID == "" {
		sessionID = body.SessionIDAlt
	}
	if sessionID == "" && user != nil {
		sessionID = user.UserID
	}

	resp, err := a.Chatbot.Ask(ctx, body.Message, sessionID)
	if err != nil {
		apierr.Respond(c, apierr.Internal("chatbot error: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"reply":              resp.Response, // backward compatibility with app ChatBot component
		"response":           resp.Response,
		"sessionId":          resp.SessionID,
		"session_id":         resp.SessionID,
		"referencedEvents":   resp.ReferencedEvents,
		"suggestedFollowups": resp.SuggestedFollowups,
		"intent":             resp.Intent,
		"providerUsed":       resp.ProviderUsed,
	})
}

// ResetChat clears the conversational history for a given session.
func (a *API) ResetChat(c *gin.Context) {
	ctx := c.Request.Context()
	user := middleware.CurrentUser(c)

	var body resetBody
	if c.Request.ContentLength > 0 {
		_ = c.ShouldBindJSON(&body)
	}

	sessionID := body.SessionID
	if sessionID == "" {
		sessionID = body.SessionIDAlt
	}
	if sessionID == "" && user != nil {
		sessionID = user.UserID
	}

	if sessionID != "" {
		_ = a.Chatbot.Reset(ctx, sessionID)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Chat session reset successfully",
	})
}
