package handlers

import (
	"context"
	"log"
	"slices"
	"time"

	"firebase.google.com/go/v4/messaging"

	"backend/internal/models"
)

// pushResult summarises a fan-out to individual device tokens.
type pushResult struct {
	Recipients int // users with at least one token
	Tokens     int
	Sent       int
	Failed     int
	Pruned     int // dead tokens removed from profiles
}

// topicsForUser returns the FCM topics a user should currently be subscribed to.
func (a *API) topicsForUser(u *models.User) []string {
	topics := []string{"all_users"}
	if u.ResolveHostStatus(a.Cfg.HostEmailDomain).IsHostCollegeStudent {
		topics = append(topics, "host_users")
	} else {
		topics = append(topics, "outside_users")
	}
	for _, r := range u.Roles {
		norm := models.NormalizeRole(r)
		if norm != "" && norm != models.RoleUser && !slices.Contains(topics, "role_"+norm) {
			topics = append(topics, "role_"+norm)
		}
	}
	if u.IsHospitality() {
		topics = append(topics, "hospitality_staff")
	}
	return topics
}

// allTopics is every topic the backend ever subscribes a token to.
func allTopics() []string {
	topics := []string{"all_users", "host_users", "outside_users", "hospitality_staff"}
	for _, r := range models.AllRoles {
		if r != models.RoleUser {
			topics = append(topics, "role_"+r)
		}
	}
	return topics
}

// syncTopics subscribes tokens to `want` and unsubscribes them from every
// other known topic, so role changes and logouts take effect for broadcasts.
func (a *API) syncTopics(ctx context.Context, tokens, want []string) {
	if len(tokens) == 0 {
		return
	}
	for _, topic := range allTopics() {
		var err error
		if slices.Contains(want, topic) {
			_, err = a.Clients.Messaging.SubscribeToTopic(ctx, tokens, topic)
		} else {
			_, err = a.Clients.Messaging.UnsubscribeFromTopic(ctx, tokens, topic)
		}
		if err != nil {
			log.Printf("[syncTopics] %s: %v", topic, err)
		}
	}
}

// syncUserTopics aligns all of a user's device tokens with their current topics.
func (a *API) syncUserTopics(ctx context.Context, u *models.User) []string {
	want := a.topicsForUser(u)
	a.syncTopics(ctx, u.AllFCMTokens(), want)
	return want
}

// sendToUsers pushes to every device of every given user, in batches of 500.
// When title is empty the message is data-only (silent). Tokens FCM reports as
// unregistered are pruned from their owner's profile.
func (a *API) sendToUsers(ctx context.Context, users []*models.User, title, body string, data map[string]string) pushResult {
	var res pushResult
	owner := map[string]string{}
	tokens := []string{}
	for _, u := range users {
		if u == nil {
			continue
		}
		ts := u.AllFCMTokens()
		if len(ts) > 0 {
			res.Recipients++
		}
		for _, t := range ts {
			if _, dup := owner[t]; dup {
				continue
			}
			owner[t] = u.UserID
			tokens = append(tokens, t)
		}
	}
	res.Tokens = len(tokens)
	if len(tokens) == 0 {
		return res
	}

	dead := map[string][]string{} // uid -> tokens
	for i := 0; i < len(tokens); i += 500 {
		chunk := tokens[i:min(i+500, len(tokens))]
		msg := &messaging.MulticastMessage{
			Tokens:  chunk,
			Data:    data,
			Android: &messaging.AndroidConfig{Priority: "high"},
		}
		if title != "" {
			msg.Notification = &messaging.Notification{Title: title, Body: body}
		} else {
			msg.APNS = &messaging.APNSConfig{
				Headers: map[string]string{"apns-push-type": "background", "apns-priority": "5"},
				Payload: &messaging.APNSPayload{Aps: &messaging.Aps{ContentAvailable: true}},
			}
		}
		resp, err := a.Clients.Messaging.SendEachForMulticast(ctx, msg)
		if err != nil {
			log.Printf("[sendToUsers] batch error: %v", err)
			res.Failed += len(chunk)
			continue
		}
		res.Sent += resp.SuccessCount
		res.Failed += resp.FailureCount
		for j, r := range resp.Responses {
			if r.Error != nil && (messaging.IsUnregistered(r.Error) || messaging.IsSenderIDMismatch(r.Error)) {
				uid := owner[chunk[j]]
				dead[uid] = append(dead[uid], chunk[j])
			}
		}
	}

	for uid, ts := range dead {
		if err := a.Store.RemoveFCMTokens(ctx, uid, ts); err != nil {
			log.Printf("[sendToUsers] could not prune tokens for %s: %v", uid, err)
			continue
		}
		res.Pruned += len(ts)
	}
	return res
}

// notifyProfileChanged tells the user's devices to refetch their profile and
// re-syncs topic subscriptions. Runs detached from the request.
func (a *API) notifyProfileChanged(u *models.User, rolesChanged bool) {
	if u == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if rolesChanged {
			a.syncUserTopics(ctx, u)
		}
		r := a.sendToUsers(ctx, []*models.User{u}, "", "", map[string]string{"type": "profile_updated"})
		log.Printf("[notifyProfileChanged] %s: sent=%d failed=%d", u.UserID, r.Sent, r.Failed)
	}()
}
