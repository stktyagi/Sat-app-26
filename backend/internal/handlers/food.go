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

// AdminGenerateFoodQR returns the signed payload to print as a mess QR for one hostel.
func (a *API) AdminGenerateFoodQR(c *gin.Context) {
	var req struct {
		HostelID string `json:"hostelId"`
	}
	if !bind(c, &req) {
		return
	}
	hostel := strings.TrimSpace(req.HostelID)
	if hostel == "" {
		apierr.Respond(c, apierr.BadRequest("missing_hostel_id", "hostelId is required"))
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"hostelId": hostel,
		"qr":       a.QR.Sign(foodQRPrefix + hostel),
	})
}

// ScanFoodQR checks the caller is checked into the scanned mess's hostel and
// has food booked for today. Blocked scans are 200 with allowed=false.
func (a *API) ScanFoodQR(c *gin.Context) {
	var req struct {
		Data string `json:"data"`
	}
	if !bind(c, &req) {
		return
	}
	payload, err := a.QR.Verify(strings.TrimSpace(req.Data))
	hostel, isFood := strings.CutPrefix(payload, foodQRPrefix)
	if err != nil || !isFood || hostel == "" {
		apierr.Respond(c, apierr.BadRequest("invalid_qr", "not a valid mess QR"))
		return
	}
	if a.Cfg.FestDay0.IsZero() {
		apierr.Respond(c, apierr.New(http.StatusServiceUnavailable, "food_not_configured", "fest dates not configured"))
		return
	}

	u := middleware.CurrentUser(c)
	day, ok := festDay(a.Cfg.FestDay0, time.Now())

	reason := ""
	switch {
	case !ok:
		reason = "not_fest_day"
	case !u.CheckInStatus.Accommodation:
		reason = "not_checked_in"
	case !strings.EqualFold(strings.TrimSpace(u.CheckInStatus.Hostel), hostel):
		reason = "wrong_hostel"
	case !u.Food[day]:
		reason = "no_food_today"
	}

	c.JSON(http.StatusOK, gin.H{
		"allowed":    reason == "",
		"reason":     reason,
		"hostelId":   hostel,
		"userHostel": u.CheckInStatus.Hostel,
		"day":        day,
		"name":       u.DisplayName,
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
