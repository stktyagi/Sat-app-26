package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"backend/internal/config"
	"backend/internal/fb"
	"backend/internal/middleware"
	"backend/internal/models"
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

	r.Static("/static", "../app/assets")

	optional := middleware.Auth(clients, s, cfg.HostEmailDomain, false)
	required := middleware.Auth(clients, s, cfg.HostEmailDomain, true)

	v1 := r.Group("/api/v1")

	// Session bootstrap needs a token but not an existing user document, since
	// creating that document is the point.
	v1.POST("/auth/session", required, api.PostSession)

	authed := v1.Group("", required, middleware.RequireUser())
	registered := v1.Group("", required, middleware.RequireUser(), middleware.RequireFullyRegistered())

	authed.GET("/me", api.GetMe)
	authed.PATCH("/me", api.PatchMe)
	authed.GET("/me/events", api.GetMyEvents)
	authed.POST("/me/fcm-token", api.UpdateFCMToken)
	authed.POST("/me/photo", api.uploadMine("photoRef", "photoUrl", "users/photos", func(u *models.User) string { return u.PhotoRef }))
	authed.POST("/me/college-id", api.uploadMine("collegeIdRef", "collegeIdUrl", "users/college-ids", func(u *models.User) string { return u.CollegeIDRef }))

	// Public browsing. The optional token is what lets a signed-in caller see
	// their own fee and registration without a second request.
	open := v1.Group("", optional)
	open.GET("/events", api.ListEvents)
	open.GET("/events/categories", api.GetCategories)
	open.GET("/events/:id", api.GetEvent)
	open.GET("/faqs", api.ListFaqs)
	open.GET("/venues", api.ListVenues)
	open.GET("/venues/:id", api.GetVenue)
	open.GET("/banners", api.ListBanners)
	open.GET("/banners/:id", api.GetBanner)
	open.GET("/reels", api.ListReels)
	open.GET("/reels/:id", api.GetReel)
	open.GET("/stories", api.ListStories)
	open.GET("/stories/:id", api.GetStory)
	open.GET("/store", api.ListStoreItems)
	open.GET("/store/:id", api.GetStoreItem)
	open.POST("/chatbot/ask", api.Chat)

	// App status, links, maintenance, versions
	open.GET("/app/status", api.GetAppConfig)
	open.GET("/app/links", api.GetAppLinks)
	open.GET("/app/maintenance", api.GetAppMaintenance)
	open.GET("/app/versions", api.GetAppVersions)
	open.GET("/app/accommodation", api.GetAppAccommodation)

	registered.POST("/events/:id/register", api.Register)
	authed.DELETE("/events/:id/register", api.Unregister)
	authed.GET("/registrations/:id", api.GetRegistration)

	registered.POST("/events/:id/teams", api.CreateTeam)
	registered.POST("/teams/join", api.JoinTeam)
	authed.GET("/teams/:teamRef", api.GetTeam)
	authed.GET("/teams/:teamRef/accommodation", api.TeamAccommodation)
	authed.PATCH("/teams/:teamRef", api.RenameTeam)
	authed.DELETE("/teams/:teamRef", api.DeleteTeam)
	authed.POST("/teams/:teamRef/leave", api.LeaveTeam)
	authed.POST("/teams/:teamRef/transfer-leader", api.TransferLeader)
	authed.DELETE("/teams/:teamRef/members/:userId", api.RemoveMember)
	authed.POST("/teams/:teamRef/confirm", api.ConfirmTeam)

	// Base staff group: accessible to any account holding an admin or committee role.
	staff := v1.Group("", required, middleware.RequireUser(), middleware.RequireStaff())

	// Top-level Admin Only: App Configuration, Notifications, FAQs, Store Items, Account Deletion
	adminOnly := staff.Group("", middleware.RequireAdmin())
	adminOnly.POST("/admin/faqs", api.CreateFaq)
	adminOnly.PATCH("/admin/faqs/:id", api.UpdateFaq)
	adminOnly.DELETE("/admin/faqs/:id", api.DeleteFaq)
	adminOnly.DELETE("/admin/users/by-email/:email", api.AdminDeleteUser)
	adminOnly.GET("/admin/store", api.AdminListStoreItems)
	adminOnly.GET("/admin/store/:id", api.AdminGetStoreItem)
	adminOnly.POST("/admin/store", api.CreateStoreItem)
	adminOnly.PATCH("/admin/store/:id", api.UpdateStoreItem)
	adminOnly.DELETE("/admin/store/:id", api.DeleteStoreItem)
	adminOnly.GET("/admin/app", api.AdminGetAppConfig)
	adminOnly.PATCH("/admin/app/links", api.AdminUpdateAppLinks)
	adminOnly.PUT("/admin/app/links", api.AdminUpdateAppLinks)
	adminOnly.PATCH("/admin/app/maintenance", api.AdminUpdateAppMaintenance)
	adminOnly.PUT("/admin/app/maintenance", api.AdminUpdateAppMaintenance)
	adminOnly.PATCH("/admin/app/versions", api.AdminUpdateAppVersions)
	adminOnly.PUT("/admin/app/versions", api.AdminUpdateAppVersions)
	adminOnly.PATCH("/admin/app/accommodation", api.AdminUpdateAppAccommodation)
	adminOnly.PUT("/admin/app/accommodation", api.AdminUpdateAppAccommodation)
	adminOnly.POST("/admin/notifications", api.SendNotification)

	// Events: Admin, EB_Events (coordinators can access scoped update/registrations)
	ebEvents := staff.Group("", middleware.RequireAnyRole(models.RoleEBEvents))
	ebEvents.POST("/admin/events", api.CreateEvent)
	ebEvents.DELETE("/admin/events/:id", api.DeleteEvent)

	eventsShared := staff.Group("", middleware.RequireAnyRole(models.RoleEBEvents, models.RoleEBOutreach, models.RoleEventPOC))
	eventsShared.PATCH("/admin/events/:id", api.UpdateEvent)
	eventsShared.GET("/admin/events/:id/registrations", api.ListEventRegistrations)
	eventsShared.PATCH("/admin/events/:id/registrations/:target/status", api.AdminUpdateRegistrationStatus)

	// Venues: Admin, EB_Events
	venues := staff.Group("", middleware.RequireAnyRole(models.RoleEBEvents))
	venues.GET("/admin/venues", api.ListVenues)
	venues.GET("/admin/venues/:id", api.GetVenue)
	venues.POST("/admin/venues", api.CreateVenue)
	venues.PATCH("/admin/venues/:id", api.UpdateVenue)
	venues.PUT("/admin/venues/:id", api.UpdateVenue)
	venues.PATCH("/admin/venues/:id/coordinates", api.UpdateVenueCoordinates)
	venues.PUT("/admin/venues/:id/coordinates", api.UpdateVenueCoordinates)
	venues.PATCH("/admin/venues/batch", api.BatchUpdateVenues)
	venues.PUT("/admin/venues/batch", api.BatchUpdateVenues)
	venues.DELETE("/admin/venues/:id", api.DeleteVenue)

	// Banners: Admin, EB_Events, EB_Media
	banners := staff.Group("", middleware.RequireAnyRole(models.RoleEBEvents, models.RoleEBMedia))
	banners.GET("/admin/banners", api.AdminListBanners)
	banners.GET("/admin/banners/:id", api.AdminGetBanner)
	banners.POST("/admin/banners", api.CreateBanner)
	banners.PATCH("/admin/banners/:id", api.UpdateBanner)
	banners.DELETE("/admin/banners/:id", api.DeleteBanner)

	// Media: Admin, EB_Events, EB_Media
	media := staff.Group("", middleware.RequireAnyRole(models.RoleEBEvents, models.RoleEBMedia))
	media.POST("/admin/media/upload", api.UploadMedia)
	media.DELETE("/admin/media", api.DeleteMedia)

	// Reels & Stories: Admin, EB_Media
	mediaContent := staff.Group("", middleware.RequireAnyRole(models.RoleEBMedia))
	mediaContent.GET("/admin/reels", api.AdminListReels)
	mediaContent.GET("/admin/reels/:id", api.AdminGetReel)
	mediaContent.POST("/admin/reels", api.CreateReel)
	mediaContent.PATCH("/admin/reels/:id", api.UpdateReel)
	mediaContent.DELETE("/admin/reels/:id", api.DeleteReel)
	mediaContent.GET("/admin/stories", api.AdminListStories)
	mediaContent.GET("/admin/stories/:id", api.AdminGetStory)
	mediaContent.POST("/admin/stories", api.CreateStory)
	mediaContent.PATCH("/admin/stories/:id", api.UpdateStory)
	mediaContent.DELETE("/admin/stories/:id", api.DeleteStory)

	// Payments: Admin, EB_Outreach, EB_Finance
	payments := staff.Group("", middleware.RequireAnyRole(models.RoleEBOutreach, models.RoleEBFinance))
	payments.GET("/admin/payments", api.AdminListPayments)
	payments.PATCH("/admin/payments/:id", api.AdminUpdatePaymentStatus)

	// Users Management: Admin, EB_Events, EB_Outreach, EB_Finance, EB_Hospitality
	users := staff.Group("", middleware.RequireAnyRole(models.RoleEBEvents, models.RoleEBOutreach, models.RoleEBFinance, models.RoleEBHospitality))
	users.GET("/admin/users/by-email/:email", api.AdminGetUser)
	users.PATCH("/admin/users/by-email/:email", api.AdminUpdateUser)
	users.GET("/admin/users/by-email/:email/registrations", api.AdminGetUserEvents)
	users.GET("/admin/users/:id", api.AdminGetUserByID)
	users.GET("/admin/users/:id/events", api.AdminGetUserEventsByID)

	// Accommodation: Admin, EB_Hospitality, EC_Hospitality
	accom := staff.Group("", middleware.RequireAnyRole(models.RoleEBHospitality, models.RoleECHospitality))
	accom.GET("/admin/accommodation", api.AdminListAccommodation)
	accom.GET("/admin/accommodation/stats", api.AdminAccommodationStats)
	accom.POST("/admin/accommodation/checkin", api.AdminHostelCheckIn)

	// QR Gate: Admin, EB_Hospitality, EC_Hospitality
	gateQR := staff.Group("", middleware.RequireAnyRole(models.RoleEBHospitality, models.RoleECHospitality))
	gateQR.POST("/admin/qr/gate-checkin", api.AdminGateCheckIn)
	gateQR.PATCH("/admin/qr/gate/:userId", api.AdminGateCheckIn)

	// QR Hostel: Admin, EB_Hospitality, EC_Hospitality
	hostelQR := staff.Group("", middleware.RequireAnyRole(models.RoleEBHospitality, models.RoleECHospitality))
	hostelQR.POST("/admin/qr/hostel-checkin", api.AdminHostelCheckIn)
	hostelQR.PATCH("/admin/qr/hostel/:userId", api.AdminHostelCheckIn)

	// QR Event: Admin, EB_Events, Event_POC
	eventQR := staff.Group("", middleware.RequireAnyRole(models.RoleEBEvents, models.RoleEventPOC))
	eventQR.POST("/admin/qr/event-checkin", api.AdminEventCheckIn)
	eventQR.PATCH("/admin/qr/registrations/:id/status", api.AdminEventCheckIn)

	// Unified Scan Endpoint: accessible to any QR role (category validation enforced in handler)
	scanQR := staff.Group("", middleware.RequireAnyRole(models.RoleEBHospitality, models.RoleECHospitality, models.RoleEBEvents, models.RoleEventPOC))
	scanQR.POST("/admin/qr/scan", api.AdminQRScan)

	// Coupons
	authed.POST("/coupons/validate", api.ValidateCoupon)

	// Payments: initiate creates a Easebuzz checkout link; callback receives
	// the Easebuzz redirect/webhook; status lets the app poll outcome.
	authed.POST("/payments/initiate", api.InitiatePayment)
	v1.POST("/payments/callback", api.PaymentCallback)
	if cfg.PaymentsDummy || cfg.EasebuzzKey == "" || cfg.EasebuzzSalt == "" {
		v1.GET("/payments/dummy", api.DummyPayment) // open: local test bypass, never in prod
	}
	authed.GET("/payments/:merchantOrderId", api.GetPayment)


	authed.POST("/deleteuser", api.DeleteSelf)

	return r
}
