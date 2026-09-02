package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
)

type askBody struct {
	Message string `json:"message"`
}

// Chat handles AI-powered questions about Saturnalia'26.
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

	_ = user.UserID // available for personalization if needed later

	reply, err := a.Chatbot.AskGroq(ctx, body.Message)
	if err != nil {
		apierr.Respond(c, apierr.Internal("chatbot error: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{"reply": reply})
}
