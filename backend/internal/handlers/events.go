package handlers

import (
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
)

const (
	defaultLimit = 50
	maxLimit     = 200
)

// ListEvents is the single endpoint for browsing, filtering and searching.
// Everything runs against the in-memory cache, which is why q is a genuine
// case-insensitive substring match rather than the whole-word-only match a
// Firestore array-contains query would allow.
func (a *API) ListEvents(c *gin.Context) {
	all, err := a.Cache.All(c.Request.Context())
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load events"))
		return
	}

	user := middleware.CurrentUser(c)
	isAdmin := user.IsAdmin()

	var (
		category  = c.Query("category")
		eventType = c.Query("eventType")
		q         = strings.TrimSpace(c.Query("q"))
		venueID   = c.Query("venueId")
		from      = c.Query("from")
		to        = c.Query("to")
		featured  = c.Query("featured")
	)

	filtered := make([]*models.Event, 0, len(all))
	for _, e := range all {
		// Drafts and cancelled events are admin-only.
		if !e.IsPublic && !isAdmin {
			continue
		}
		if category != "" && !strings.EqualFold(e.Category, category) {
			continue
		}
		if eventType != "" && e.EventType != eventType {
			continue
		}
		if venueID != "" && e.VenueID != venueID {
			continue
		}
		if featured != "" && e.IsFeatured != (featured == "true") {
			continue
		}
		// Every stored date uses one fixed-width UTC format, so a plain string
		// comparison is a correct chronological comparison.
		if from != "" && e.StartDateTime != "" && e.StartDateTime < from {
			continue
		}
		if to != "" && e.StartDateTime != "" && e.StartDateTime > to {
			continue
		}
		if !e.Matches(q) {
			continue
		}
		if user != nil {
			fee := e.FeeFor(user.IsHostCollegeStudent)
			e.EffectiveFee = &fee
		}
		filtered = append(filtered, e)
	}

	sortEvents(filtered, c.Query("sort"))

	limit, offset := page(c)
	total := len(filtered)
	if offset > total {
		offset = total
	}
	end := offset + limit
	if end > total {
		end = total
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  filtered[offset:end],
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func sortEvents(list []*models.Event, mode string) {
	switch mode {
	case "-startDateTime":
		sort.SliceStable(list, func(i, j int) bool { return list[i].StartDateTime > list[j].StartDateTime })
	case "featured":
		sort.SliceStable(list, func(i, j int) bool {
			if list[i].IsFeatured != list[j].IsFeatured {
				return list[i].IsFeatured
			}
			return list[i].StartDateTime < list[j].StartDateTime
		})
	default:
		sort.SliceStable(list, func(i, j int) bool { return list[i].StartDateTime < list[j].StartDateTime })
	}
}

func page(c *gin.Context) (limit, offset int) {
	limit = defaultLimit
	if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 {
		limit = min(v, maxLimit)
	}
	if v, err := strconv.Atoi(c.Query("offset")); err == nil && v > 0 {
		offset = v
	}
	return limit, offset
}

func (a *API) GetEvent(c *gin.Context) {
	event, ok := a.loadVisibleEvent(c, c.Param("id"))
	if !ok {
		return
	}

	body := gin.H{"event": event}

	// A signed-in caller gets their own pricing and their existing registration
	// in the same round trip, so the detail screen needs no follow-up call.
	if user := middleware.CurrentUser(c); user != nil {
		fee := event.FeeFor(user.IsHostCollegeStudent)
		event.EffectiveFee = &fee

		reg, err := a.Store.GetRegistration(c.Request.Context(), models.RegistrationID(event.EventID, user.UserID))
		if err == nil {
			reg.QRToken = a.QR.Sign(reg.ID)
			body["myRegistration"] = reg
			if reg.TeamID != "" {
				if team, err := a.Store.GetTeam(c.Request.Context(), reg.TeamID); err == nil {
					a.hydrateMembers(c.Request.Context(), team)
					body["myTeam"] = team
				}
			}
		}
	}

	c.JSON(http.StatusOK, body)
}

// GetCategories returns the categories actually present on visible events, so
// the filter chips never offer an option that matches nothing.
func (a *API) GetCategories(c *gin.Context) {
	all, err := a.Cache.All(c.Request.Context())
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load events"))
		return
	}

	isAdmin := middleware.CurrentUser(c).IsAdmin()
	seen := map[string]bool{}
	out := []string{}
	for _, e := range all {
		if (!e.IsPublic && !isAdmin) || e.Category == "" || seen[e.Category] {
			continue
		}
		seen[e.Category] = true
		out = append(out, e.Category)
	}
	sort.Strings(out)

	c.JSON(http.StatusOK, gin.H{"categories": out})
}

// GetMyEvents lists everything the caller is registered for, with the QR token
// and team details attached.
func (a *API) GetMyEvents(c *gin.Context) {
	ctx := c.Request.Context()
	user := middleware.CurrentUser(c)

	regs, err := a.Store.ListUserRegistrations(ctx, user.UserID)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load your registrations"))
		return
	}

	items := make([]gin.H, 0, len(regs))
	for _, reg := range regs {
		reg.QRToken = a.QR.Sign(reg.ID)
		row := gin.H{"registration": reg}

		if event, err := a.Cache.Get(ctx, reg.EventID); err == nil {
			fee := event.FeeFor(user.IsHostCollegeStudent)
			event.EffectiveFee = &fee
			row["event"] = event
		}
		// teamId is the team document ID, so this is a direct read rather than
		// a query.
		if reg.TeamID != "" {
			if team, err := a.Store.GetTeam(ctx, reg.TeamID); err == nil {
				a.hydrateMembers(ctx, team)
				row["team"] = team
			}
		}
		items = append(items, row)
	}

	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

// loadVisibleEvent fetches an event and enforces the draft visibility rule.
func (a *API) loadVisibleEvent(c *gin.Context, id string) (*models.Event, bool) {
	event, err := a.Cache.Get(c.Request.Context(), id)
	if err != nil {
		apierr.Respond(c, apierr.NotFound("event_not_found", "no such event"))
		return nil, false
	}
	if !event.IsPublic && !middleware.CurrentUser(c).IsAdmin() {
		apierr.Respond(c, apierr.NotFound("event_not_found", "no such event"))
		return nil, false
	}
	return event, true
}
