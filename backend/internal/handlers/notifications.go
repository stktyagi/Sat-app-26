package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"firebase.google.com/go/v4/messaging"

	"backend/internal/apierr"
	"backend/internal/middleware"
)

// updateFCMTokenBody is the request body for updating a user's FCM token.
type updateFCMTokenBody struct {
	FCMToken string `json:"fcmToken"`
}

// UpdateFCMToken stores or replaces the authenticated user's FCM token and
// subscribes the token to the required FCM topics (all_users + host_users
// or outside_users based on the verified email domain).
func (a *API) UpdateFCMToken(c *gin.Context) {
	ctx := c.Request.Context()
	user := middleware.CurrentUser(c)
	if user == nil {
		apierr.Respond(c, apierr.Unauthorized("missing_user", "call POST /api/v1/auth/session first"))
		return
	}

	var body updateFCMTokenBody
	if !bind(c, &body) {
		return
	}
	if strings.TrimSpace(body.FCMToken) == "" {
		apierr.Respond(c, apierr.BadRequest("invalid_token", "fcmToken is required"))
		return
	}

	// Replace the stored FCM token in Firestore.
	updated, err := a.Store.UpdateUser(ctx, user.UserID, map[string]any{
		"fcmToken": strings.TrimSpace(body.FCMToken),
	})
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not update FCM token"))
		return
	}

	// Resolve host vs outside using the verified email domain (backend-authoritative).
	isHost := updated.ResolveHostStatus(a.Cfg.HostEmailDomain).IsHostCollegeStudent

	// Subscribe to the common all_users topic plus the audience-specific topic.
	topics := []string{"all_users"}
	if isHost {
		topics = append(topics, "host_users")
	} else {
		topics = append(topics, "outside_users")
	}

	for _, topic := range topics {
		if _, err := a.Clients.Messaging.SubscribeToTopic(ctx, []string{updated.FCMToken}, topic); err != nil {
			apierr.Respond(c, apierr.Internal("could not subscribe to "+topic))
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "FCM token updated and subscribed"})
}

// audienceTopic maps the three allowed audience values to their fixed FCM topics.
func audienceTopic(audience string) (string, bool) {
	switch audience {
	case "all":
		return "all_users", true
	case "host":
		return "host_users", true
	case "outside":
		return "outside_users", true
	default:
		return "", false
	}
}

// sendNotificationBody is the request body for sending an admin notification.
type sendNotificationBody struct {
	Audience string `json:"audience"`
	Title    string `json:"title"`
	Body     string `json:"body"`
}

// SendNotification sends an FCM notification to one of the three fixed
// audiences (all, host, outside). Only admins are authorised.
func (a *API) SendNotification(c *gin.Context) {
	ctx := c.Request.Context()

	var body sendNotificationBody
	if !bind(c, &body) {
		return
	}

	topic, ok := audienceTopic(strings.TrimSpace(body.Audience))
	if !ok {
		apierr.Respond(c, apierr.BadRequest("invalid_audience", "audience must be one of: all, host, outside"))
		return
	}

	if strings.TrimSpace(body.Title) == "" || strings.TrimSpace(body.Body) == "" {
		apierr.Respond(c, apierr.BadRequest("invalid_body", "title and body are required"))
		return
	}

	msg := &messaging.Message{
		Notification: &messaging.Notification{
			Title: strings.TrimSpace(body.Title),
			Body:  strings.TrimSpace(body.Body),
		},
		Topic: topic,
	}

	resp, err := a.Clients.Messaging.Send(ctx, msg)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not send notification"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "notification sent", "messageId": resp})
}
