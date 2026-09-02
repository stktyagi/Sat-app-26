package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/random"
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

	// Invite codes are unique per event because the document ID embeds both. A
	// collision therefore surfaces as a failed Create, and retrying draws a
	// fresh code.
	for attempt := 0; attempt < 5; attempt++ {
		code := random.Code(6)
		team := models.NewTeam(event.EventID, code, body.TeamName, user.UserID, event.MinTeamSize, body.Responses)
		reg := models.NewRegistration(user.UserID, event.EventID, team.TeamID, code, fee, body.Responses)

		err := a.Store.CreateTeamWithLeader(ctx, team, regID, reg)
		switch {
		case err == nil:
			a.Cache.Invalidate()
			a.hydrateMembers(ctx, team)
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
	reg := models.NewRegistration(user.UserID, event.EventID, team.TeamID, team.InviteCode, fee, body.Responses)

	updated, err := a.Store.JoinTeam(ctx, team.TeamID, user.UserID, regID, reg, event.MinTeamSize, event.MaxTeamSize)
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
	a.hydrateMembers(ctx, updated)

	c.JSON(http.StatusOK, gin.H{"team": updated})
}

func (a *API) GetTeam(c *gin.Context) {
	team, ok := a.loadTeam(c)
	if !ok {
		return
	}
	a.presentTeam(c, team)
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

	if err := a.Store.UpdateTeam(c.Request.Context(), team.TeamID, map[string]any{"teamName": name}); err != nil {
		apierr.Respond(c, apierr.Internal("could not rename the team"))
		return
	}
	a.reloadAndRespond(c, team.TeamID, "renamed but the team could not be read back")
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
		if len(team.MemberIDs) > 1 {
			apierr.Respond(c, apierr.Conflict("leader_cannot_leave",
				"transfer leadership or remove the other members first").
				WithDetails(gin.H{"memberCount": len(team.MemberIDs)}))
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

	if err := a.Store.DeleteTeam(c.Request.Context(), team.TeamID, user.UserID); err != nil {
		switch {
		case errors.Is(err, store.ErrTeamNotEmpty):
			apierr.Respond(c, apierr.Conflict("team_not_empty",
				"remove the other members before deleting the team").
				WithDetails(gin.H{"memberCount": len(team.MemberIDs)}))
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

	if err := a.Store.UpdateTeam(c.Request.Context(), team.TeamID, map[string]any{"leaderUserId": body.UserID}); err != nil {
		apierr.Respond(c, apierr.Internal("could not transfer leadership"))
		return
	}
	a.reloadAndRespond(c, team.TeamID, "transferred but the team could not be read back")
}

func (a *API) applyMemberRemoval(c *gin.Context, team *models.Team, event *models.Event, target string) {
	minSize := 0
	if event != nil {
		minSize = event.MinTeamSize
	}

	if err := a.Store.RemoveMember(c.Request.Context(), team.TeamID, target, minSize); err != nil {
		if errors.Is(err, store.ErrNotMember) {
			apierr.Respond(c, apierr.NotFound("not_a_member", "that user is not in this team"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not update the team"))
		return
	}
	a.Cache.Invalidate()

	a.reloadAndRespond(c, team.TeamID, "updated but the team could not be read back")
}

// reloadAndRespond re-reads a team after a mutation so the response always
// reflects what is actually stored.
func (a *API) reloadAndRespond(c *gin.Context, teamID, failure string) {
	updated, err := a.Store.GetTeam(c.Request.Context(), teamID)
	if err != nil {
		apierr.Respond(c, apierr.Internal(failure))
		return
	}
	a.presentTeam(c, updated)
}

// presentTeam applies the visibility rules and writes the response. The invite
// code is what lets someone join, and the member roster is other people's
// details, so both stay inside the team.
func (a *API) presentTeam(c *gin.Context, team *models.Team) {
	user := middleware.CurrentUser(c)
	if team.HasMember(user.UserID) || user.IsAdmin() {
		a.hydrateMembers(c.Request.Context(), team)
	} else {
		team.InviteCode = ""
	}
	c.JSON(http.StatusOK, gin.H{"team": team})
}

// hydrateMembers turns the stored member IDs into displayable profiles with one
// batch read. Nothing about a member is copied into the team document, so this
// is the only place the roster is assembled and it can never be stale.
func (a *API) hydrateMembers(ctx context.Context, team *models.Team) {
	users, err := a.Store.GetUsers(ctx, team.MemberIDs)
	if err != nil {
		return
	}
	members := make([]models.PublicProfile, 0, len(team.MemberIDs))
	for _, id := range team.MemberIDs {
		u, ok := users[id]
		if !ok {
			continue
		}
		members = append(members, u.ResolveHostStatus(a.Cfg.HostEmailDomain).Public())
	}
	team.Members = members
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
	ctx := c.Request.Context()

	if eventID != "" {
		team, err := a.Store.GetTeam(ctx, models.TeamRef(eventID, code))
		if err != nil {
			return nil, apierr.NotFound("team_not_found", "no team with that invite code")
		}
		return team, nil
	}

	teams, err := a.Store.FindTeamsByInviteCode(ctx, code)
	if err != nil {
		return nil, apierr.Internal("could not look up the invite code")
	}
	switch len(teams) {
	case 0:
		return nil, apierr.NotFound("team_not_found", "no team with that invite code")
	case 1:
		return teams[0], nil
	default:
		// The team carries no copy of the event title, so the names offered to
		// disambiguate come from the event cache and are always current.
		options := make([]gin.H, 0, len(teams))
		for _, t := range teams {
			name := ""
			if event, err := a.Cache.Get(ctx, t.EventID); err == nil {
				name = event.Title
			}
			options = append(options, gin.H{"eventId": t.EventID, "eventName": name})
		}
		return nil, apierr.Conflict("ambiguous_code",
			"that code matches teams in more than one event; supply eventId").
			WithDetails(gin.H{"events": options})
	}
}
