package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
)

// GetAppConfig returns all app documents (links, maintenance, versions) in one call.
func (a *API) GetAppConfig(c *gin.Context) {
	config, err := a.Store.GetAppConfig(c.Request.Context())
	if err != nil {
		log.Printf("[GetAppConfig] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not fetch app configuration"))
		return
	}
	c.JSON(http.StatusOK, config)
}

// GetAppLinks returns playstore and appstore links.
func (a *API) GetAppLinks(c *gin.Context) {
	links, err := a.Store.GetAppLinks(c.Request.Context())
	if err != nil {
		log.Printf("[GetAppLinks] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not fetch app links"))
		return
	}
	c.JSON(http.StatusOK, links)
}

// GetAppMaintenance returns the maintenance status for android, ios, and web.
func (a *API) GetAppMaintenance(c *gin.Context) {
	maint, err := a.Store.GetAppMaintenance(c.Request.Context())
	if err != nil {
		log.Printf("[GetAppMaintenance] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not fetch app maintenance status"))
		return
	}
	c.JSON(http.StatusOK, maint)
}

// GetAppVersions returns the minimum required versions for android and ios.
func (a *API) GetAppVersions(c *gin.Context) {
	versions, err := a.Store.GetAppVersions(c.Request.Context())
	if err != nil {
		log.Printf("[GetAppVersions] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not fetch app versions"))
		return
	}
	c.JSON(http.StatusOK, versions)
}

// AdminGetAppConfig returns the app config for admin review.
func (a *API) AdminGetAppConfig(c *gin.Context) {
	config, err := a.Store.GetAppConfig(c.Request.Context())
	if err != nil {
		log.Printf("[AdminGetAppConfig] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not fetch app config"))
		return
	}
	c.JSON(http.StatusOK, config)
}

// AdminUpdateAppLinks updates the app store links (app/link).
func (a *API) AdminUpdateAppLinks(c *gin.Context) {
	var body models.AppLinks
	if !bind(c, &body) {
		return
	}

	if err := a.Store.SetAppLinks(c.Request.Context(), &body); err != nil {
		log.Printf("[AdminUpdateAppLinks] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not update app links"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"links": body})
}

// AdminUpdateAppMaintenance updates the maintenance flags (app/maintenance).
func (a *API) AdminUpdateAppMaintenance(c *gin.Context) {
	var body models.AppMaintenance
	if !bind(c, &body) {
		return
	}

	if err := a.Store.SetAppMaintenance(c.Request.Context(), &body); err != nil {
		log.Printf("[AdminUpdateAppMaintenance] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not update maintenance status"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"maintenance": body})
}

// AdminUpdateAppVersions updates the version constraints (app/versions).
func (a *API) AdminUpdateAppVersions(c *gin.Context) {
	var body models.AppVersions
	if !bind(c, &body) {
		return
	}

	if err := a.Store.SetAppVersions(c.Request.Context(), &body); err != nil {
		log.Printf("[AdminUpdateAppVersions] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not update app versions"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"versions": body})
}

// GetAppAccommodation returns the accommodation pricing configuration.
func (a *API) GetAppAccommodation(c *gin.Context) {
	acc, err := a.Store.GetAppAccommodation(c.Request.Context())
	if err != nil {
		log.Printf("[GetAppAccommodation] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not fetch accommodation configuration"))
		return
	}
	c.JSON(http.StatusOK, acc)
}

// GetAccommodationAvailability returns current remaining accommodation spots.
// Privacy rule: Does not disclose female accommodation counts or female presence to male callers.
func (a *API) GetAccommodationAvailability(c *gin.Context) {
	ctx := c.Request.Context()
	avail, err := a.Store.GetAccommodationAvailability(ctx)
	if err != nil {
		log.Printf("[GetAccommodationAvailability] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not fetch accommodation availability"))
		return
	}

	user := middleware.CurrentUser(c)
	isAdmin := user.IsAdmin()

	// If admin, they get the full gender breakdown
	if isAdmin {
		c.JSON(http.StatusOK, gin.H{
			"limits": gin.H{
				"male":   models.MaxMaleAccommodation,
				"female": models.MaxFemaleAccommodation,
			},
			"booked": avail,
			"remaining": gin.H{
				"day0": gin.H{
					"male":   max(0, models.MaxMaleAccommodation-avail.Day0.Male),
					"female": max(0, models.MaxFemaleAccommodation-avail.Day0.Female),
				},
				"day1": gin.H{
					"male":   max(0, models.MaxMaleAccommodation-avail.Day1.Male),
					"female": max(0, models.MaxFemaleAccommodation-avail.Day1.Female),
				},
				"day2": gin.H{
					"male":   max(0, models.MaxMaleAccommodation-avail.Day2.Male),
					"female": max(0, models.MaxFemaleAccommodation-avail.Day2.Female),
				},
				"day3": gin.H{
					"male":   max(0, models.MaxMaleAccommodation-avail.Day3.Male),
					"female": max(0, models.MaxFemaleAccommodation-avail.Day3.Female),
				},
				"day4": gin.H{
					"male":   max(0, models.MaxMaleAccommodation-avail.Day4.Male),
					"female": max(0, models.MaxFemaleAccommodation-avail.Day4.Female),
				},
			},
		})
		return
	}

	// For standard participants:
	// If caller is Female, return Female availability.
	// If caller is Male (or unauthenticated), return Male availability.
	// Crucially: Never disclose female statistics/presence to male callers.
	gender := "male"
	if user != nil {
		gender = models.NormalizeGender(user.Gender)
	}

	isFemale := gender == "female"
	limit := models.MaxMaleAccommodation
	if isFemale {
		limit = models.MaxFemaleAccommodation
	}

	buildDay := func(bookedCount int) gin.H {
		rem := max(0, limit-bookedCount)
		return gin.H{
			"remaining": rem,
			"total":     limit,
			"isSoldOut": rem <= 0,
		}
	}

	var d0, d1, d2, d3, d4 int
	if isFemale {
		d0, d1, d2, d3, d4 = avail.Day0.Female, avail.Day1.Female, avail.Day2.Female, avail.Day3.Female, avail.Day4.Female
	} else {
		d0, d1, d2, d3, d4 = avail.Day0.Male, avail.Day1.Male, avail.Day2.Male, avail.Day3.Male, avail.Day4.Male
	}

	c.JSON(http.StatusOK, gin.H{
		"days": gin.H{
			"day0": buildDay(d0),
			"day1": buildDay(d1),
			"day2": buildDay(d2),
			"day3": buildDay(d3),
			"day4": buildDay(d4),
		},
	})
}

// AdminReconcileAccommodation recalculates accommodation counts from existing users and updates counters.
func (a *API) AdminReconcileAccommodation(c *gin.Context) {
	doc, err := a.Store.ReconcileAccommodationAvailability(c.Request.Context())
	if err != nil {
		log.Printf("[AdminReconcileAccommodation] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not reconcile accommodation counts"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "availability": doc})
}

// AdminUpdateAppAccommodation updates the accommodation pricing (app/accommodation).
func (a *API) AdminUpdateAppAccommodation(c *gin.Context) {
	var body models.AppAccommodation
	if !bind(c, &body) {
		return
	}

	// Merge per-day prices with stored ones so existing days are preserved
	// when updating, while allowing overrides for specific days.
	if cur, err := a.Store.GetAppAccommodation(c.Request.Context()); err == nil && cur != nil {
		mergeDays := func(curMap, newMap map[string]int) map[string]int {
			if curMap == nil && newMap == nil {
				return nil
			}
			out := map[string]int{}
			for k, v := range curMap {
				out[k] = v
			}
			for k, v := range newMap {
				out[k] = v
			}
			return out
		}
		body.TechnicalDays = mergeDays(cur.TechnicalDays, body.TechnicalDays)
		body.CulturalDays = mergeDays(cur.CulturalDays, body.CulturalDays)
		body.TechnicalFoodDays = mergeDays(cur.TechnicalFoodDays, body.TechnicalFoodDays)
		body.CulturalFoodDays = mergeDays(cur.CulturalFoodDays, body.CulturalFoodDays)
	}

	if err := a.Store.SetAppAccommodation(c.Request.Context(), &body); err != nil {
		log.Printf("[AdminUpdateAppAccommodation] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not update accommodation configuration"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"accommodation": body})
}

// GetAdminNavigation returns the admin screens filtered on the backend for the current user.
func (a *API) GetAdminNavigation(c *gin.Context) {
	ctx := c.Request.Context()
	user := middleware.CurrentUser(c)
	if user == nil || !user.IsStaffOrAdmin() {
		apierr.Respond(c, apierr.Forbidden("not_staff", "access denied"))
		return
	}

	screens, err := a.Store.GetAdminScreens(ctx)
	if err != nil {
		log.Printf("[GetAdminNavigation] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not load admin navigation"))
		return
	}

	visible := make([]models.AdminScreenConfig, 0, len(screens))
	for _, s := range screens {
		if user.IsAdmin() || user.HasAnyRole(s.RequiredRoles...) {
			visible = append(visible, s)
		}
	}

	c.JSON(http.StatusOK, gin.H{"items": visible})
}

// AdminGetAdminScreens returns all admin screen configs with their required roles.
func (a *API) AdminGetAdminScreens(c *gin.Context) {
	ctx := c.Request.Context()
	screens, err := a.Store.GetAdminScreens(ctx)
	if err != nil {
		log.Printf("[AdminGetAdminScreens] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not load admin screens config"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"screens": screens})
}

// AdminUpdateAdminScreens updates the admin screen role mappings.
func (a *API) AdminUpdateAdminScreens(c *gin.Context) {
	ctx := c.Request.Context()

	var body struct {
		Screens []models.AdminScreenConfig `json:"screens"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		var rawList []models.AdminScreenConfig
		if err2 := c.ShouldBindJSON(&rawList); err2 != nil {
			apierr.Respond(c, apierr.BadRequest("invalid_body", "screens array is required"))
			return
		}
		body.Screens = rawList
	}

	if len(body.Screens) == 0 {
		apierr.Respond(c, apierr.BadRequest("empty_screens", "screens list cannot be empty"))
		return
	}

	if err := a.Store.SetAdminScreens(ctx, body.Screens); err != nil {
		log.Printf("[AdminUpdateAdminScreens] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not update admin screens configuration"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"screens": body.Screens})
}
