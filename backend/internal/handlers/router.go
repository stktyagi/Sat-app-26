package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"backend/internal/config"
	"backend/internal/fb"
	"backend/internal/middleware"
	"backend/internal/store"
)

// Router wires every route. Three auth postures are used:
//
//   - open: no token needed, but one is read if supplied so the response can
//     carry per-user pricing and registration state
//   - authed: a valid token plus an existing user document
//   - registered: the above plus a completed profile, required to register
func Router(cfg *config.Config, clients *fb.Clients, s *store.Store, cache *store.EventCache, api *API) *gin.Engine {
	r := gin.New()
	r.Use(middleware.WithRequestID(), middleware.Recovery(), gin.Logger(), middleware.CORS(cfg.AllowedOrigins))

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	optional := middleware.Auth(clients, s, cfg.HostEmailDomain, false)
	required := middleware.Auth(clients, s, cfg.HostEmailDomain, true)

	v1 := r.Group("/api/v1")

	// Session bootstrap needs a token but not an existing user document, since
	// creating that document is the point.
	v1.POST("/auth/session", required, api.PostSession)

	authed := v1.Group("", required, middleware.RequireUser())
	registered := v1.Group("", required, middleware.RequireUser(), middleware.RequireFullyRegistered())
	admin := v1.Group("", required, middleware.RequireUser(), middleware.RequireAdmin())

	authed.GET("/me", api.GetMe)
	authed.PATCH("/me", api.PatchMe)
	authed.GET("/me/events", api.GetMyEvents)

	// Public browsing. The optional token is what lets a signed-in caller see
	// their own fee and registration without a second request.
	open := v1.Group("", optional)
	open.GET("/events", api.ListEvents)
	open.GET("/events/categories", api.GetCategories)
	open.GET("/events/:id", api.GetEvent)

	registered.POST("/events/:id/register", api.Register)
	authed.DELETE("/events/:id/register", api.Unregister)
	authed.GET("/registrations/:id", api.GetRegistration)

	registered.POST("/events/:id/teams", api.CreateTeam)
	registered.POST("/teams/join", api.JoinTeam)
	authed.GET("/teams/:teamRef", api.GetTeam)
	authed.PATCH("/teams/:teamRef", api.RenameTeam)
	authed.DELETE("/teams/:teamRef", api.DeleteTeam)
	authed.POST("/teams/:teamRef/leave", api.LeaveTeam)
	authed.POST("/teams/:teamRef/transfer-leader", api.TransferLeader)
	authed.DELETE("/teams/:teamRef/members/:userId", api.RemoveMember)

	admin.POST("/admin/events", api.CreateEvent)
	admin.PATCH("/admin/events/:id", api.UpdateEvent)
	admin.DELETE("/admin/events/:id", api.DeleteEvent)
	admin.GET("/admin/events/:id/registrations", api.ListEventRegistrations)

	// FCM: client registers its token; admins broadcast to audiences.
	authed.POST("/me/fcm-token", api.UpdateFCMToken)
	admin.POST("/admin/notifications", api.SendNotification)

	return r
}
