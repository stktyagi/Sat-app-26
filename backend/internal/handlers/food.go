package handlers

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/config"
	"backend/internal/isotime"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/store"
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

// clock returns the API's notion of now; tests may override Now.
func (a *API) clock() time.Time {
	if a.Now != nil {
		return a.Now()
	}
	return time.Now()
}

// currentMealSlot returns the meal slot whose IST window contains now.
func currentMealSlot(now time.Time) (string, bool) {
	n := now.In(config.IST)
	mins := n.Hour()*60 + n.Minute()
	for _, s := range models.MealSlots {
		start, ok1 := hhmm(s.Start)
		end, ok2 := hhmm(s.End)
		if ok1 && ok2 && mins >= start && mins < end {
			return s.Key, true
		}
	}
	return "", false
}

func hhmm(v string) (int, bool) {
	t, err := time.Parse("15:04", v)
	if err != nil {
		return 0, false
	}
	return t.Hour()*60 + t.Minute(), true
}

type mealResult struct {
	Allowed bool
	Reason  string
	Day     string
	Slot    string
}

// checkAndLogMeal decides whether u may eat now and, if so, records the meal.
// qrDay is "" for code entry, else the day encoded in the mess QR ("all" or dayN).
func (a *API) checkAndLogMeal(ctx context.Context, u *models.User, qrDay, method, by string) mealResult {
	now := a.clock()
	day, isFestDay := festDay(a.Cfg.FestDay0, now)
	slot, inSlot := currentMealSlot(now)
	r := mealResult{Day: day, Slot: slot}

	switch {
	case !isFestDay:
		r.Reason = "not_fest_day"
	case qrDay != "" && qrDay != "all" && stayDays[qrDay] && qrDay != day:
		r.Reason = "wrong_day"
	case u.Food == nil || !u.Food[day]:
		r.Reason = "no_food_today"
	case !inSlot:
		r.Reason = "no_active_slot"
	}
	if r.Reason != "" {
		return r
	}

	// Store is nil only in handler unit tests.
	if a.Store != nil {
		err := a.Store.LogMeal(ctx, &models.MealLog{
			UserID:     u.UserID,
			Name:       u.DisplayName,
			Email:      u.Email,
			Phone:      u.PhoneNumber,
			College:    u.CollegeName,
			Gender:     u.Gender,
			Day:        day,
			Slot:       slot,
			At:         isotime.Format(now),
			Method:     method,
			VerifiedBy: by,
		})
		if err != nil && !errors.Is(err, store.ErrMealAvailed) {
			log.Printf("[food] could not log meal for %s: %v", u.UserID, err)
			r.Reason = "log_failed"
			return r
		}
	}
	r.Allowed = true
	return r
}

// ScanFoodQR checks the caller has food booked for the current day and meal
// slot, and logs the meal so each slot can be availed.
// Supports day-specific mess QRs ("food:dayX") as well as all-day QRs ("food:all").
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

	r := a.checkAndLogMeal(c.Request.Context(), u, qrDay, "qr", u.UserID)

	a.LogAudit("meal_qr_scan", "food", u, u, map[string]any{
		"qrDay":   qrDay,
		"allowed": r.Allowed,
		"reason":  r.Reason,
		"day":     r.Day,
		"slot":    r.Slot,
		"method":  "qr",
	})

	c.JSON(http.StatusOK, gin.H{
		"allowed":                   r.Allowed,
		"reason":                    r.Reason,
		"day":                       r.Day,
		"slot":                      r.Slot,
		"qrDay":                     qrDay,
		"name":                      u.DisplayName,
		"needsAccommodationCheckIn": !u.CheckInStatus.Accommodation,
	})
}

func (a *API) mealCodeFor(uid string) string {
	return a.QR.Code("meal:" + uid)
}

// GetMyMealCode returns the caller's typed meal code, storing it on first use
// so staff can look the user up by it.
func (a *API) GetMyMealCode(c *gin.Context) {
	u := middleware.CurrentUser(c)
	if u == nil {
		apierr.Respond(c, apierr.Unauthorized("unauthorized", "login required"))
		return
	}
	code := a.mealCodeFor(u.UserID)
	if u.MealCode != code {
		if err := a.Store.SetMealCode(c.Request.Context(), u.UserID, code); err != nil {
			apierr.Respond(c, apierr.Internal("could not save meal code"))
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"code": code})
}

// AdminVerifyMealCode is the staff-side fallback for an unscannable mess QR:
// the participant shows their meal code and staff type it in.
func (a *API) AdminVerifyMealCode(c *gin.Context) {
	var req struct {
		Code string `json:"code"`
	}
	if !bind(c, &req) {
		return
	}
	code := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(req.Code), " ", ""))
	if len(code) != 8 {
		apierr.Respond(c, apierr.BadRequest("invalid_code", "meal code must be 8 characters"))
		return
	}
	if a.Cfg.FestDay0.IsZero() {
		apierr.Respond(c, apierr.New(http.StatusServiceUnavailable, "food_not_configured", "fest dates not configured"))
		return
	}
	ctx := c.Request.Context()
	u, err := a.Store.GetUserByMealCode(ctx, code)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Respond(c, apierr.NotFound("code_not_found", "no participant has this meal code"))
			return
		}
		apierr.Respond(c, apierr.Internal("could not look up meal code"))
		return
	}
	caller := middleware.CurrentUser(c)
	r := a.checkAndLogMeal(ctx, u, "", "code", callerID(caller))
	a.LogAudit("meal_code_verify", "food", caller, u, map[string]any{
		"code":    code,
		"allowed": r.Allowed,
		"reason":  r.Reason,
		"day":     r.Day,
		"slot":    r.Slot,
		"method":  "code",
	})
	c.JSON(http.StatusOK, gin.H{
		"allowed":     r.Allowed,
		"reason":      r.Reason,
		"day":         r.Day,
		"slot":        r.Slot,
		"userId":      u.UserID,
		"name":        u.DisplayName,
		"email":       u.Email,
		"collegeName": u.CollegeName,
		"photoUrl":    u.PhotoURL,
	})
}

// AdminListMealLogs returns who availed meals, filtered by day and optional slot.
func (a *API) AdminListMealLogs(c *gin.Context) {
	day := strings.TrimSpace(c.Query("day"))
	slot := strings.ToLower(strings.TrimSpace(c.Query("slot")))
	if day == "" || !stayDays[day] {
		apierr.Respond(c, apierr.BadRequest("invalid_day", "day must be one of day0..day4"))
		return
	}
	if slot == "all" {
		slot = ""
	}
	if slot != "" && !models.IsMealSlot(slot) {
		apierr.Respond(c, apierr.BadRequest("invalid_slot", "slot must be breakfast, lunch, dinner or all"))
		return
	}
	logs, err := a.Store.ListMealLogs(c.Request.Context(), day, slot)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load meal logs"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"day": day, "slot": slot, "count": len(logs), "logs": logs})
}

// GetMealSlots exposes the slot windows so the app can label them.
func (a *API) GetMealSlots(c *gin.Context) {
	slot, _ := currentMealSlot(a.clock())
	c.JSON(http.StatusOK, gin.H{"slots": models.MealSlots, "current": slot})
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
