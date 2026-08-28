package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/store"
)

type createTeamBody struct {
	TeamName  string            `json:"teamName"`
	Responses []models.Response `json:"responses"`
}

// CreateTeam registers the leader and opens the team in one transaction, so a
// team can never exist without its leader being registered for the event.
func (a *API) CreateTeam(c *gin.Context) {
	ctx := c.Request.Context()
	user := middleware.CurrentUser(c)

	var body createTeamBody
	if !bind(c, &body) {
		return
	}
	body.TeamName = strings.TrimSpace(body.TeamName)
	if body.TeamName == "" {
		apierr.Respond(c, apierr.BadRequest("invalid_team_name", "teamName is required"))
		return
	}

	event, ok := a.loadVisibleEvent(c, c.Param("id"))
	if !ok {
		return
	}
	if err := a.checkRegistrable(ctx, event, user, models.EventTypeTeam); err != nil {
		apierr.Respond(c, err)
		return
	}
	if err := validateResponses(event, body.Responses); err != nil {
		apierr.Respond(c, err)
		return
	}

	fee := event.FeeFor(user.IsHostCollegeStudent)
	regID := models.RegistrationID(event.EventID, user.UserID)
	now := models.NowString()

	// Invite codes are unique per event because the document ID embeds both.
	// A collision therefore surfaces as a failed Create, and retrying draws a
	// fresh code.
	for attempt := 0; attempt < 5; attempt++ {
		code := models.RandomCode(6)
		ref := models.TeamRef(event.EventID, code)
		teamID := uuid.NewString()

		teamDoc := map[string]any{
			"teamId":       teamID,
			"eventId":      event.EventID,
			"eventName":    event.Title,
			"eventType":    event.EventType,
			"teamName":     body.TeamName,
			"leaderUserId": user.UserID,
			"inviteCode":   code,
			"status":       models.StatusFor(1, event.MinTeamSize),
			"members":      []any{user.TeamMember(now)},
			"responses":    models.ResponsesToDocs(body.Responses),
			"createdAt":    now,
			"updatedAt":    now,
		}
		regDoc := models.NewRegistrationDoc(user, event, teamID, code, fee, body.Responses)

		err := a.Store.CreateTeamWithLeader(ctx, ref, teamDoc, regID, regDoc)
		switch {
		case err == nil:
			team, err := a.Store.GetTeam(ctx, ref)
			if err != nil {
				apierr.Respond(c, apierr.Internal("team created but could not be read back"))
				return
			}
			a.Cache.Invalidate()
			c.JSON(http.StatusCreated, gin.H{"team": team, "inviteCode": code})
			return

		case errors.Is(err, store.ErrExists):
			// Either the invite code collided or this user is already
			// registered for the event. Only the first is worth retrying.
			if _, regErr := a.Store.GetRegistration(ctx, regID); regErr == nil {
				apierr.Respond(c, apierr.Conflict("already_registered", "you are already registered for this event"))
				return
			}
			continue

		default:
			apierr.Respond(c, apierr.Internal("could not create the team"))
			return
		}
	}

	apierr.Respond(c, apierr.Internal("could not allocate an invite code"))
}

type joinTeamBody struct {
	InviteCode string            `json:"inviteCode"`
	EventID    string            `json:"eventId"`
	Responses  []models.Response `json:"responses"`
}

// JoinTeam adds the caller to a team by invite code and registers them for the
// event in the same transaction.
func (a *API) JoinTeam(c *gin.Context) {
	ctx := c.Request.Context()
	user := middleware.CurrentUser(c)

	var body joinTeamBody
	if !bind(c, &body) {
		return
	}
	code := strings.ToUpper(strings.TrimSpace(body.InviteCode))
	if code == "" {
		apierr.Respond(c, apierr.BadRequest("invalid_code", "inviteCode is required"))
		return
	}

	team, apiErr := a.resolveTeamByCode(c, code, body.EventID)
	if apiErr != nil {
		apierr.Respond(c, apiErr)
		return
	}

	event, err := a.Cache.Get(ctx, team.EventID)
	if err != nil {
		apierr.Respond(c, apierr.NotFound("event_not_found", "the event for this team no longer exists"))
		return
	}
	if err := a.checkRegistrable(ctx, event, user, models.EventTypeTeam); err != nil {
		apierr.Respond(c, err)
		return
	}
	if err := validateResponses(event, body.Responses); err != nil {
		apierr.Respond(c, err)
		return
	}

	fee := event.FeeFor(user.IsHostCollegeStudent)
	regID := models.RegistrationID(event.EventID, user.UserID)
	regDoc := models.NewRegistrationDoc(user, event, team.TeamID, team.InviteCode, fee, body.Responses)
	member := user.TeamMember(models.NowString())

	_, err = a.Store.JoinTeam(ctx, team.Ref, user.UserID, member, regID, regDoc, event.MinTeamSize, event.MaxTeamSize)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrTeamFull):
			apierr.Respond(c, apierr.Conflict("team_full", "this team is already at its maximum size"))
		case errors.Is(err, store.ErrAlreadyMember):
			apierr.Respond(c, apierr.Conflict("already_member", "you are already in this team"))
		case errors.Is(err, store.ErrExists):
			apierr.Respond(c, apierr.Conflict("already_registered", "you are already registered for this event"))
		case errors.Is(err, store.ErrNotFound):
			apierr.Respond(c, apierr.NotFound("team_not_found", "no team with that invite code"))
		default:
			apierr.Respond(c, apierr.Internal("could not join the team"))
		}
		return
	}
	a.Cache.Invalidate()

	updated, err := a.Store.GetTeam(ctx, team.Ref)
	if err != nil {
		apierr.Respond(c, apierr.Internal("joined but the team could not be read back"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"team": updated})
}

func (a *API) GetTeam(c *gin.Context) {
	team, ok := a.loadTeam(c)
	if !ok {
		return
	}
	user := middleware.CurrentUser(c)
	// The invite code is what lets someone join, so it stays inside the team.
	if !team.HasMember(user.UserID) && !user.IsAdmin() {
		team.InviteCode = ""
	}
	c.JSON(http.StatusOK, gin.H{"team": team})
}

type renameTeamBody struct {
	TeamName string `json:"teamName"`
}

func (a *API) RenameTeam(c *gin.Context) {
	team, ok := a.loadTeam(c)
	if !ok {
		return
	}
	if !team.IsLeader(middleware.CurrentUser(c).UserID) {
		apierr.Respond(c, apierr.Forbidden("leader_only", "only the team leader can rename the team"))
		return
	}

	var body renameTeamBody
	if !bind(c, &body) {
		return
	}
	name := strings.TrimSpace(body.TeamName)
	if name == "" {
		apierr.Respond(c, apierr.BadRequest("invalid_team_name", "teamName is required"))
		return
	}

	if err := a.Store.UpdateTeam(c.Request.Context(), team.Ref, map[string]any{"teamName": name}); err != nil {
		apierr.Respond(c, apierr.Internal("could not rename the team"))
		return
	}
	updated, err := a.Store.GetTeam(c.Request.Context(), team.Ref)
	if err != nil {
		apierr.Respond(c, apierr.Internal("renamed but the team could not be read back"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"team": updated})
}

// RemoveMember lets the leader drop someone from the team. That member
// registration is deleted in the same transaction.
func (a *API) RemoveMember(c *gin.Context) {
	team, event, ok := a.loadTeamForMutation(c)
	if !ok {
		return
	}
	user := middleware.CurrentUser(c)
	target := c.Param("userId")

	if !team.IsLeader(user.UserID) {
		apierr.Respond(c, apierr.Forbidden("leader_only", "only the team leader can remove members"))
		return
	}
	if target == team.LeaderUserID {
		apierr.Respond(c, apierr.BadRequest("cannot_remove_leader",
			"the leader cannot be removed; transfer leadership or delete the team"))
		return
	}

	a.applyMemberRemoval(c, team, event, target)
}

// LeaveTeam lets a member remove themselves. The leader cannot leave while
// anyone else remains, otherwise the team would be left with no owner.
func (a *API) LeaveTeam(c *gin.Context) {
	team, event, ok := a.loadTeamForMutation(c)
	if !ok {
		return
	}
	user := middleware.CurrentUser(c)

	if !team.HasMember(user.UserID) {
		apierr.Respond(c, apierr.Forbidden("not_a_member", "you are not in this team"))
		return
	}
	if team.IsLeader(user.UserID) {
		if len(team.Members) > 1 {
			apierr.Respond(c, apierr.Conflict("leader_cannot_leave",
				"transfer leadership or remove the other members first").
				WithDetails(gin.H{"memberCount": len(team.Members)}))
			return
		}
		apierr.Respond(c, apierr.Conflict("delete_instead",
			"you are the last member; delete the team instead"))
		return
	}

	a.applyMemberRemoval(c, team, event, user.UserID)
}

// DeleteTeam removes the team once the leader is the only member left.
func (a *API) DeleteTeam(c *gin.Context) {
	team, _, ok := a.loadTeamForMutation(c)
	if !ok {
		return
	}
	user := middleware.CurrentUser(c)

	if !team.IsLeader(user.UserID) {
		apierr.Respond(c, apierr.Forbidden("leader_only", "only the team leader can delete the team"))
		return
	}

	if err := a.Store.DeleteTeam(c.Request.Context(), team.Ref, user.UserID); err != nil {
		switch {
		case errors.Is(err, store.ErrTeamNotEmpty):
			apierr.Respond(c, apierr.Conflict("team_not_empty",
				"remove the other members before deleting the team").
				WithDetails(gin.H{"memberCount": len(team.Members)}))
		case errors.Is(err, store.ErrNotLeader):
			apierr.Respond(c, apierr.Forbidden("leader_only", "only the team leader can delete the team"))
		default:
			apierr.Respond(c, apierr.Internal("could not delete the team"))
		}
		return
	}
	a.Cache.Invalidate()

	c.Status(http.StatusNoContent)
}

type transferBody struct {
	UserID string `json:"userId"`
}

// TransferLeader hands the team over to another member. Without it a leader who
// wants out of a full team has no legal move: they cannot leave and cannot
// delete.
func (a *API) TransferLeader(c *gin.Context) {
	team, _, ok := a.loadTeamForMutation(c)
	if !ok {
		return
	}
	user := middleware.CurrentUser(c)

	if !team.IsLeader(user.UserID) {
		apierr.Respond(c, apierr.Forbidden("leader_only", "only the team leader can transfer leadership"))
		return
	}

	var body transferBody
	if !bind(c, &body) {
		return
	}
	if body.UserID == user.UserID {
		apierr.Respond(c, apierr.BadRequest("already_leader", "you are already the leader"))
		return
	}
	if !team.HasMember(body.UserID) {
		apierr.Respond(c, apierr.BadRequest("not_a_member", "that user is not in this team"))
		return
	}

	if err := a.Store.UpdateTeam(c.Request.Context(), team.Ref, map[string]any{"leaderUserId": body.UserID}); err != nil {
		apierr.Respond(c, apierr.Internal("could not transfer leadership"))
		return
	}
	updated, err := a.Store.GetTeam(c.Request.Context(), team.Ref)
	if err != nil {
		apierr.Respond(c, apierr.Internal("transferred but the team could not be read back"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"team": updated})
}

func (a *API) applyMemberRemoval(c *gin.Context, team *models.Team, event *models.Event, target string) {
	minSize := 0
	if event != nil {
		minSize = event.MinTeamSize
	}

	if err := a.Store.RemoveMember(c.Request.Context(), team.Ref, target, minSize); err != nil {
		if errors.Is(err, store.ErrNotMember) {
			apierr.Respond(c, apierr.NotFound("not_a_member", "that user is not in this team"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not update the team"))
		return
	}
	a.Cache.Invalidate()

	updated, err := a.Store.GetTeam(c.Request.Context(), team.Ref)
	if err != nil {
		apierr.Respond(c, apierr.Internal("updated but the team could not be read back"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"team": updated})
}

func (a *API) loadTeam(c *gin.Context) (*models.Team, bool) {
	team, err := a.Store.GetTeam(c.Request.Context(), c.Param("teamRef"))
	if err != nil {
		apierr.Respond(c, apierr.NotFound("team_not_found", "no such team"))
		return nil, false
	}
	return team, true
}

// loadTeamForMutation additionally refuses changes once registration has closed.
func (a *API) loadTeamForMutation(c *gin.Context) (*models.Team, *models.Event, bool) {
	team, ok := a.loadTeam(c)
	if !ok {
		return nil, nil, false
	}

	event, err := a.Cache.Get(c.Request.Context(), team.EventID)
	if err != nil {
		// The event is gone; allow the team to be cleaned up regardless.
		return team, nil, true
	}
	if !event.IsRegistrationOpen(time.Now()) {
		apierr.Respond(c, apierr.Conflict("registration_closed", "teams are locked once registration has closed"))
		return nil, nil, false
	}
	return team, event, true
}

// resolveTeamByCode turns a bare invite code into a team. Codes are unique
// within an event but not across events, so an ambiguous code asks the caller
// for the event rather than guessing.
func (a *API) resolveTeamByCode(c *gin.Context, code, eventID string) (*models.Team, *apierr.Error) {
	if eventID != "" {
		team, err := a.Store.GetTeam(c.Request.Context(), models.TeamRef(eventID, code))
		if err != nil {
			return nil, apierr.NotFound("team_not_found", "no team with that invite code")
		}
		return team, nil
	}

	teams, err := a.Store.FindTeamsByInviteCode(c.Request.Context(), code)
	if err != nil {
		return nil, apierr.Internal("could not look up the invite code")
	}
	switch len(teams) {
	case 0:
		return nil, apierr.NotFound("team_not_found", "no team with that invite code")
	case 1:
		return teams[0], nil
	default:
		options := make([]gin.H, 0, len(teams))
		for _, t := range teams {
			options = append(options, gin.H{"eventId": t.EventID, "eventName": t.EventName})
		}
		return nil, apierr.Conflict("ambiguous_code",
			"that code matches teams in more than one event; supply eventId").
			WithDetails(gin.H{"events": options})
	}
}
