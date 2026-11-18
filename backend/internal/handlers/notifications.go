package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"firebase.google.com/go/v4/messaging"
	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/config"
	"backend/internal/middleware"
	"backend/internal/models"
)

// updateFCMTokenBody is the request body for updating a user's FCM token.
type updateFCMTokenBody struct {
	FCMToken string `json:"fcmToken"`
}

// UpdateFCMToken stores or replaces the authenticated user's FCM token and
// subscribes the token to the required FCM topics:
// - all_users
// - host_users or outside_users
// - role_<role> for every role the user holds
// - hospitality_staff (if holding any hospitality role)
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
	token := strings.TrimSpace(body.FCMToken)
	if token == "" {
		apierr.Respond(c, apierr.BadRequest("invalid_token", "fcmToken is required"))
		return
	}

	// Replace the stored FCM token in Firestore.
	updated, err := a.Store.UpdateUser(ctx, user.UserID, map[string]any{
		"fcmToken": token,
	})
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not update FCM token"))
		return
	}

	// Resolve host vs outside using the verified email domain (backend-authoritative).
	isHost := updated.ResolveHostStatus(a.Cfg.HostEmailDomain).IsHostCollegeStudent

	topics := []string{"all_users"}
	if isHost {
		topics = append(topics, "host_users")
	} else {
		topics = append(topics, "outside_users")
	}

	// Subscribe to specific role topics
	for _, r := range updated.Roles {
		norm := models.NormalizeRole(r)
		if norm != "" && norm != models.RoleUser {
			topics = append(topics, "role_"+norm)
		}
	}

	// If hospitality role, subscribe to common hospitality topic
	if updated.IsHospitality() {
		topics = append(topics, "hospitality_staff")
	}

	for _, topic := range topics {
		if _, err := a.Clients.Messaging.SubscribeToTopic(ctx, []string{token}, topic); err != nil {
			log.Printf("[UpdateFCMToken] warning: could not subscribe to %s: %v", topic, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "FCM token updated and subscribed", "topics": topics})
}

// audienceTopic maps the three allowed audience values to their fixed FCM topics.
func audienceTopic(audience string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(audience)) {
	case "all":
		return "all_users", true
	case "host":
		return "host_users", true
	case "outside":
		return "outside_users", true
	case "hospitality_staff":
		return "hospitality_staff", true
	default:
		return "", false
	}
}

// NotificationFilter allows targeting by fields in the user model.
type NotificationFilter struct {
	HasAccommodation bool `json:"hasAccommodation"`
	InHouse          bool `json:"inHouse"`
	CheckoutDueToday bool `json:"checkoutDueToday"`
}

// sendNotificationBody is the request body for sending an admin notification.
type sendNotificationBody struct {
	Audience string              `json:"audience"` // "all", "host", "outside", "roles", "filter"
	Roles    []string            `json:"roles"`    // role names when audience is "roles"
	Filter   *NotificationFilter `json:"filter"`   // custom user filters when audience is "filter"
	Title    string              `json:"title"`
	Body     string              `json:"body"`
}

// sendMulticast sends notifications to a list of device FCM tokens in batches of up to 500.
func (a *API) sendMulticast(ctx context.Context, tokens []string, title, body string) (int, error) {
	if len(tokens) == 0 {
		return 0, nil
	}
	successCount := 0
	batchSize := 500
	for i := 0; i < len(tokens); i += batchSize {
		end := i + batchSize
		if end > len(tokens) {
			end = len(tokens)
		}
		chunk := tokens[i:end]
		resp, err := a.Clients.Messaging.SendEachForMulticast(ctx, &messaging.MulticastMessage{
			Tokens: chunk,
			Notification: &messaging.Notification{
				Title: title,
				Body:  body,
			},
		})
		if err != nil {
			log.Printf("[FCM Multicast] error: %v", err)
			continue
		}
		successCount += resp.SuccessCount
	}
	return successCount, nil
}

// SendNotification sends a one-time FCM notification targeted by topic, role, or user filter.
func (a *API) SendNotification(c *gin.Context) {
	ctx := c.Request.Context()

	var body sendNotificationBody
	if !bind(c, &body) {
		return
	}

	title := strings.TrimSpace(body.Title)
	notifBody := strings.TrimSpace(body.Body)
	if title == "" || notifBody == "" {
		apierr.Respond(c, apierr.BadRequest("invalid_body", "title and body are required"))
		return
	}

	audience := strings.ToLower(strings.TrimSpace(body.Audience))

	// 1. Topic-based broadcast ("all", "host", "outside", "hospitality_staff")
	if topic, ok := audienceTopic(audience); ok {
		msg := &messaging.Message{
			Notification: &messaging.Notification{
				Title: title,
				Body:  notifBody,
			},
			Topic: topic,
		}
		resp, err := a.Clients.Messaging.Send(ctx, msg)
		if err != nil {
			log.Printf("[SendNotification] error sending to topic %s: %v", topic, err)
			apierr.Respond(c, apierr.Internal("could not send notification"))
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "notification sent", "target": topic, "messageId": resp})
		return
	}

	// 2. Role-based targeting
	if audience == "roles" || len(body.Roles) > 0 {
		targetRoles := body.Roles
		if len(targetRoles) == 0 {
			apierr.Respond(c, apierr.BadRequest("missing_roles", "roles array is required when targeting by role"))
			return
		}

		users, err := a.Store.GetUsersByRoles(ctx, targetRoles)
		if err != nil {
			log.Printf("[SendNotification] error fetching users by roles: %v", err)
			apierr.Respond(c, apierr.Internal("could not fetch targeted users"))
			return
		}

		tokenSet := map[string]struct{}{}
		for _, u := range users {
			t := strings.TrimSpace(u.FCMToken)
			if t != "" {
				tokenSet[t] = struct{}{}
			}
		}

		tokens := make([]string, 0, len(tokenSet))
		for t := range tokenSet {
			tokens = append(tokens, t)
		}

		if len(tokens) == 0 {
			c.JSON(http.StatusOK, gin.H{"message": "no active user tokens found for the selected roles", "recipientCount": 0})
			return
		}

		sent, err := a.sendMulticast(ctx, tokens, title, notifBody)
		if err != nil {
			apierr.Respond(c, apierr.Internal("could not send multicast notification"))
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "notification sent successfully", "recipientCount": len(tokens), "deliveredCount": sent})
		return
	}

	// 3. User model filter-based targeting
	if audience == "filter" && body.Filter != nil {
		users, err := a.Store.ListAccommodationUsers(ctx)
		if err != nil {
			log.Printf("[SendNotification] error fetching accommodation users: %v", err)
			apierr.Respond(c, apierr.Internal("could not fetch users"))
			return
		}

		todayIdx := festDayIndex(a.Cfg.FestDay0, time.Now())

		var tokens []string
		for _, u := range users {
			t := strings.TrimSpace(u.FCMToken)
			if t == "" {
				continue
			}

			if body.Filter.InHouse {
				if !u.CheckInStatus.Accommodation || u.CheckInStatus.CheckedOut {
					continue
				}
			}

			if body.Filter.CheckoutDueToday {
				if !u.CheckInStatus.Accommodation || u.CheckInStatus.CheckedOut {
					continue
				}
				if lastStayDay(u.Accommodation) != todayIdx {
					continue
				}
			}

			tokens = append(tokens, t)
		}

		if len(tokens) == 0 {
			c.JSON(http.StatusOK, gin.H{"message": "no matching users found for the filter criteria", "recipientCount": 0})
			return
		}

		sent, err := a.sendMulticast(ctx, tokens, title, notifBody)
		if err != nil {
			apierr.Respond(c, apierr.Internal("could not send multicast notification"))
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "filtered notification sent", "recipientCount": len(tokens), "deliveredCount": sent})
		return
	}

	apierr.Respond(c, apierr.BadRequest("invalid_audience", "audience must be one of: all, host, outside, hospitality_staff, roles, filter"))
}

// RunDailyHospitalitySummary computes incoming arrivals and outgoing checkouts,
// sending notifications to:
// 1. Hospitality roles (eb_hospitality, ec_hospitality, core_hospitality) and admins with the day's summary.
// 2. Outgoing attendees whose accommodation ends today with a checkout reminder.
func (a *API) RunDailyHospitalitySummary(ctx context.Context) (gin.H, error) {
	now := time.Now().In(config.IST)
	todayIdx := festDayIndex(a.Cfg.FestDay0, now)
	tomorrowIdx := todayIdx + 1

	todayKey := fmt.Sprintf("day%d", todayIdx)
	tomorrowKey := fmt.Sprintf("day%d", tomorrowIdx)

	users, err := a.Store.ListAccommodationUsers(ctx)
	if err != nil {
		return nil, fmt.Errorf("could not load accommodation users: %w", err)
	}

	incomingCount := 0
	outgoingCount := 0
	var outgoingTokens []string

	for _, u := range users {
		// Incoming: booked for tomorrow, not yet checked into hostel
		if u.Accommodation[tomorrowKey] && !u.CheckInStatus.Accommodation {
			incomingCount++
		}

		// Outgoing: currently checked into hostel, and stay ends today
		if u.CheckInStatus.Accommodation && !u.CheckInStatus.CheckedOut {
			if lastStayDay(u.Accommodation) == todayIdx {
				outgoingCount++
				if strings.TrimSpace(u.FCMToken) != "" {
					outgoingTokens = append(outgoingTokens, strings.TrimSpace(u.FCMToken))
				}
			}
		}
	}

	// 1. Send summary to hospitality staff & administrators
	staffRoles := []string{
		models.RoleAdmin,
		models.RoleEBHospitality,
		models.RoleECHospitality,
		models.RoleCoreHospitality,
	}
	staffUsers, err := a.Store.GetUsersByRoles(ctx, staffRoles)
	if err != nil {
		log.Printf("[RunDailyHospitalitySummary] warning: could not load staff users: %v", err)
	}

	var staffTokens []string
	for _, su := range staffUsers {
		t := strings.TrimSpace(su.FCMToken)
		if t != "" {
			staffTokens = append(staffTokens, t)
		}
	}

	staffNotified := 0
	if len(staffTokens) > 0 {
		reportTitle := "Hospitality Daily Overview 📋"
		reportBody := fmt.Sprintf(
			"Today (%s) summary: %d guests due for checkout. %d incoming arrivals expected tomorrow (%s).",
			todayKey, outgoingCount, incomingCount, tomorrowKey,
		)
		sent, err := a.sendMulticast(ctx, staffTokens, reportTitle, reportBody)
		if err != nil {
			log.Printf("[RunDailyHospitalitySummary] error sending to staff: %v", err)
		} else {
			staffNotified = sent
		}
	}

	// 2. Send checkout reminder to outgoing attendees
	attendeesNotified := 0
	if len(outgoingTokens) > 0 {
		reminderTitle := "Hostel Checkout Reminder 🛏️"
		reminderBody := "Your hostel accommodation ends today. Please visit the hospitality desk to return your bedding items and complete your checkout."
		sent, err := a.sendMulticast(ctx, outgoingTokens, reminderTitle, reminderBody)
		if err != nil {
			log.Printf("[RunDailyHospitalitySummary] error sending to attendees: %v", err)
		} else {
			attendeesNotified = sent
		}
	}

	log.Printf("[RunDailyHospitalitySummary] completed for %s: incoming=%d, outgoing=%d, staffNotified=%d, attendeesNotified=%d",
		todayKey, incomingCount, outgoingCount, staffNotified, attendeesNotified)

	return gin.H{
		"today":             todayKey,
		"tomorrow":          tomorrowKey,
		"incomingTomorrow":  incomingCount,
		"outgoingToday":     outgoingCount,
		"staffNotified":     staffNotified,
		"attendeesNotified": attendeesNotified,
		"timestamp":         now.Format(time.RFC3339),
	}, nil
}

// AdminTriggerHospitalitySummary allows administrators to trigger the daily summary immediately.
func (a *API) AdminTriggerHospitalitySummary(c *gin.Context) {
	ctx := c.Request.Context()
	result, err := a.RunDailyHospitalitySummary(ctx)
	if err != nil {
		log.Printf("[AdminTriggerHospitalitySummary] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not run hospitality summary"))
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "Hospitality summary notifications dispatched successfully",
		"data":    result,
	})
}
