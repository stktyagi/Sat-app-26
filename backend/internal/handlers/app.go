package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
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

// AdminUpdateAppAccommodation updates the accommodation pricing (app/accommodation).
func (a *API) AdminUpdateAppAccommodation(c *gin.Context) {
	var body models.AppAccommodation
	if !bind(c, &body) {
		return
	}

	// The admin app doesn't send per-day prices yet; keep the stored ones
	// rather than wiping them on a full Set.
	if cur, err := a.Store.GetAppAccommodation(c.Request.Context()); err == nil && cur != nil {
		if body.TechnicalDays == nil {
			body.TechnicalDays = cur.TechnicalDays
		}
		if body.CulturalDays == nil {
			body.CulturalDays = cur.CulturalDays
		}
		if body.TechnicalFoodDays == nil {
			body.TechnicalFoodDays = cur.TechnicalFoodDays
		}
		if body.CulturalFoodDays == nil {
			body.CulturalFoodDays = cur.CulturalFoodDays
		}
	}

	if err := a.Store.SetAppAccommodation(c.Request.Context(), &body); err != nil {
		log.Printf("[AdminUpdateAppAccommodation] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not update accommodation configuration"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"accommodation": body})
}
