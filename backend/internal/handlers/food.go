package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/config"
	"backend/internal/middleware"
)

// Food QRs reuse the registration QR signer; the prefix keeps the two
// payload spaces apart.
const foodQRPrefix = "food:"

// AdminGenerateFoodQR returns the signed payload to print as a common mess QR for a specific fest day or for all days.
func (a *API) AdminGenerateFoodQR(c *gin.Context) {
	var req struct {
		Day string `json:"day"`
	}
	_ = c.ShouldBindJSON(&req)

	day := strings.TrimSpace(req.Day)
	if day == "" {
		if a.Cfg.FestDay0.IsZero() {
			apierr.Respond(c, apierr.New(http.StatusServiceUnavailable, "food_not_configured", "fest dates not configured"))
			return
		}
		var ok bool
		day, ok = festDay(a.Cfg.FestDay0, time.Now())
		if !ok {
			apierr.Respond(c, apierr.BadRequest("not_fest_day", "today is not a fest day"))
			return
		}
	} else if day != "all" && !stayDays[day] {
		apierr.Respond(c, apierr.BadRequest("invalid_day", "day must be one of day0..day4 or all"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"day": day,
		"qr":  a.QR.Sign(foodQRPrefix + day),
	})
}

// ScanFoodQR checks the caller has food booked for today.
// Supports day-specific mess QRs ("food:dayX") as well as all-day multi-day mess QRs ("food:all").
// Blocked scans are 200 with allowed=false.
// Accommodation check-in is not mandatory to receive food, but an alert flag is returned.
func (a *API) ScanFoodQR(c *gin.Context) {
	var req struct {
		Data string `json:"data"`
	}
	if !bind(c, &req) {
		return
	}
	payload, err := a.QR.Verify(strings.TrimSpace(req.Data))
	qrDay, isFood := strings.CutPrefix(payload, foodQRPrefix)
	if err != nil || !isFood || (qrDay != "all" && !stayDays[qrDay]) {
		apierr.Respond(c, apierr.BadRequest("invalid_qr", "not a valid mess QR"))
		return
	}
	if a.Cfg.FestDay0.IsZero() {
		apierr.Respond(c, apierr.New(http.StatusServiceUnavailable, "food_not_configured", "fest dates not configured"))
		return
	}

	u := middleware.CurrentUser(c)
	if u == nil {
		apierr.Respond(c, apierr.Unauthorized("unauthorized", "login required"))
		return
	}

	currentDay, ok := festDay(a.Cfg.FestDay0, time.Now())

	reason := ""
	switch {
	case !ok:
		reason = "not_fest_day"
	case qrDay != "all" && stayDays[qrDay] && qrDay != currentDay:
		reason = "wrong_day"
	case u.Food == nil || !u.Food[currentDay]:
		reason = "no_food_today"
	}

	// Accommodation check-in is not mandatory to receive food, but attendees
	// who haven't checked into their hostel are flagged so the app can show a closable alert.
	needsCheckIn := !u.CheckInStatus.Accommodation

	c.JSON(http.StatusOK, gin.H{
		"allowed":                   reason == "",
		"reason":                    reason,
		"day":                       currentDay,
		"qrDay":                     qrDay,
		"name":                      u.DisplayName,
		"needsAccommodationCheckIn": needsCheckIn,
	})
}

// festDay maps now to "day0".."day4" counting IST calendar days from day0.
func festDay(day0, now time.Time) (string, bool) {
	n := now.In(config.IST)
	today := time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, config.IST)
	d0 := day0.In(config.IST)
	start := time.Date(d0.Year(), d0.Month(), d0.Day(), 0, 0, 0, 0, config.IST)
	diff := int(today.Sub(start).Hours() / 24)
	if today.Before(start) || diff > 4 {
		return "", false
	}
	return fmt.Sprintf("day%d", diff), true
}
