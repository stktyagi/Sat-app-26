package handlers

import (
	"context"
	"errors"
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
	"backend/internal/store"
)

// updateFCMTokenBody is the request body for registering/removing a device's FCM token.
type updateFCMTokenBody struct {
	FCMToken string `json:"fcmToken"`
}

// UpdateFCMToken adds the device token to the authenticated user's profile
// (one entry per device) and aligns its topic subscriptions with the user's
// current audience: all_users, host_users|outside_users, role_<role>, and
// hospitality_staff.
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

	updated, err := a.Store.AddFCMToken(ctx, user.UserID, token)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not update FCM token"))
		return
	}

	topics := a.topicsForUser(updated)
	a.syncTopics(ctx, []string{token}, topics)

	c.JSON(http.StatusOK, gin.H{"message": "FCM token updated and subscribed", "topics": topics})
}

// RemoveFCMToken detaches a device (on logout): the token is dropped from the
// profile and unsubscribed from every topic, so the device stops receiving
// this account's notifications.
func (a *API) RemoveFCMToken(c *gin.Context) {
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

	if err := a.Store.RemoveFCMTokens(ctx, user.UserID, []string{token}); err != nil {
		apierr.Respond(c, apierr.Internal("could not remove FCM token"))
		return
	}
	a.syncTopics(ctx, []string{token}, nil)

	c.JSON(http.StatusOK, gin.H{"message": "FCM token removed"})
}

// audienceTopic maps the broadcast audience values to their fixed FCM topics.
func audienceTopic(audience string) (string, bool) {
	switch audience {
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
	Audience string              `json:"audience"` // "all", "host", "outside", "hospitality_staff", "roles", "users", "filter"
	Roles    []string            `json:"roles"`    // role names when audience is "roles"
	UserIDs  []string            `json:"userIds"`  // user IDs when audience is "users"
	Emails   []string            `json:"emails"`   // emails when audience is "users"
	Filter   *NotificationFilter `json:"filter"`   // custom user filters when audience is "filter"
	Title    string              `json:"title"`
	Body     string              `json:"body"`
}

// respondPush writes the standard response for a per-device fan-out.
func respondPush(c *gin.Context, r pushResult, extra gin.H) {
	msg := "notification sent"
	if r.Tokens == 0 {
		msg = "no registered devices found for the selected audience"
	}
	out := gin.H{
		"message":        msg,
		"recipientCount": r.Recipients,
		"deviceCount":    r.Tokens,
		"deliveredCount": r.Sent,
		"failedCount":    r.Failed,
		"prunedCount":    r.Pruned,
	}
	for k, v := range extra {
		out[k] = v
	}
	c.JSON(http.StatusOK, out)
}

// SendNotification sends a one-time FCM notification targeted by topic,
// role, specific users, or user filter.
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
	data := map[string]string{"type": "admin_broadcast"}

	// 1. Topic-based broadcast
	if topic, ok := audienceTopic(audience); ok {
		resp, err := a.Clients.Messaging.Send(ctx, &messaging.Message{
			Notification: &messaging.Notification{Title: title, Body: notifBody},
			Data:         data,
			Topic:        topic,
		})
		if err != nil {
			log.Printf("[SendNotification] error sending to topic %s: %v", topic, err)
			apierr.Respond(c, apierr.Internal("could not send notification"))
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "notification sent", "target": topic, "messageId": resp})
		return
	}

	switch audience {
	case "roles":
		if len(body.Roles) == 0 {
			apierr.Respond(c, apierr.BadRequest("missing_roles", "roles array is required when targeting by role"))
			return
		}
		users, err := a.Store.GetUsersByRoles(ctx, body.Roles)
		if err != nil {
			log.Printf("[SendNotification] error fetching users by roles: %v", err)
			apierr.Respond(c, apierr.Internal("could not fetch targeted users"))
			return
		}
		respondPush(c, a.sendToUsers(ctx, users, title, notifBody, data), nil)

	case "users":
		if len(body.UserIDs) == 0 && len(body.Emails) == 0 {
			apierr.Respond(c, apierr.BadRequest("missing_users", "userIds or emails are required when targeting users"))
			return
		}
		if len(body.UserIDs)+len(body.Emails) > 1000 {
			apierr.Respond(c, apierr.BadRequest("too_many_users", "at most 1000 users per send"))
			return
		}
		users, unmatched, err := a.resolveUsers(ctx, body.UserIDs, body.Emails)
		if err != nil {
			log.Printf("[SendNotification] error resolving users: %v", err)
			apierr.Respond(c, apierr.Internal("could not fetch targeted users"))
			return
		}
		respondPush(c, a.sendToUsers(ctx, users, title, notifBody, data), gin.H{"unmatched": unmatched})

	case "filter":
		if body.Filter == nil {
			apierr.Respond(c, apierr.BadRequest("missing_filter", "filter is required when audience is filter"))
			return
		}
		users, err := a.Store.ListAccommodationUsers(ctx)
		if err != nil {
			log.Printf("[SendNotification] error fetching accommodation users: %v", err)
			apierr.Respond(c, apierr.Internal("could not fetch users"))
			return
		}
		todayIdx := festDayIndex(a.Cfg.FestDay0, time.Now())
		var targets []*models.User
		for _, u := range users {
			if body.Filter.InHouse || body.Filter.CheckoutDueToday {
				if !u.CheckInStatus.Accommodation || u.CheckInStatus.CheckedOut {
					continue
				}
			}
			if body.Filter.CheckoutDueToday && lastStayDay(u.Accommodation) != todayIdx {
				continue
			}
			targets = append(targets, u)
		}
		respondPush(c, a.sendToUsers(ctx, targets, title, notifBody, data), nil)

	default:
		apierr.Respond(c, apierr.BadRequest("invalid_audience", "audience must be one of: all, host, outside, hospitality_staff, roles, users, filter"))
	}
}

// resolveUsers loads users by ID and by email, returning the inputs that
// matched no account.
func (a *API) resolveUsers(ctx context.Context, ids, emails []string) ([]*models.User, []string, error) {
	seen := map[string]bool{}
	var users []*models.User
	unmatched := []string{}

	cleanIDs := make([]string, 0, len(ids))
	for _, id := range ids {
		if id = strings.TrimSpace(id); id != "" {
			cleanIDs = append(cleanIDs, id)
		}
	}
	byID, err := a.Store.GetUsers(ctx, cleanIDs)
	if err != nil {
		return nil, nil, err
	}
	for _, id := range cleanIDs {
		u, ok := byID[id]
		if !ok {
			unmatched = append(unmatched, id)
			continue
		}
		if !seen[u.UserID] {
			seen[u.UserID] = true
			users = append(users, u)
		}
	}

	for _, e := range emails {
		e = strings.TrimSpace(e)
		if e == "" {
			continue
		}
		u, err := a.Store.GetUserByEmail(ctx, e)
		if errors.Is(err, store.ErrNotFound) && strings.ToLower(e) != e {
			u, err = a.Store.GetUserByEmail(ctx, strings.ToLower(e))
		}
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				unmatched = append(unmatched, e)
				continue
			}
			return nil, nil, err
		}
		if !seen[u.UserID] {
			seen[u.UserID] = true
			users = append(users, u)
		}
	}
	return users, unmatched, nil
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
	var outgoingUsers []*models.User

	for _, u := range users {
		// Incoming: booked for tomorrow, not yet checked into hostel
		if u.Accommodation[tomorrowKey] && !u.CheckInStatus.Accommodation {
			incomingCount++
		}

		// Outgoing: currently checked into hostel, and stay ends today
		if u.CheckInStatus.Accommodation && !u.CheckInStatus.CheckedOut {
			if lastStayDay(u.Accommodation) == todayIdx {
				outgoingCount++
				outgoingUsers = append(outgoingUsers, u)
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

	staffNotified := 0
	if len(staffUsers) > 0 {
		reportTitle := "Hospitality Daily Overview 📋"
		reportBody := fmt.Sprintf(
			"Today (%s) summary: %d guests due for checkout. %d incoming arrivals expected tomorrow (%s).",
			todayKey, outgoingCount, incomingCount, tomorrowKey,
		)
		staffNotified = a.sendToUsers(ctx, staffUsers, reportTitle, reportBody, map[string]string{"type": "hospitality_summary"}).Sent
	}

	// 2. Send checkout reminder to outgoing attendees
	attendeesNotified := 0
	if len(outgoingUsers) > 0 {
		reminderTitle := "Hostel Checkout Reminder 🛏️"
		reminderBody := "Your hostel accommodation ends today. Please visit the hospitality desk to return your bedding items and complete your checkout."
		attendeesNotified = a.sendToUsers(ctx, outgoingUsers, reminderTitle, reminderBody, map[string]string{"type": "checkout_reminder"}).Sent
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
