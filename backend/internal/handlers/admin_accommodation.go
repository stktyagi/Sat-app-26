package handlers

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/config"
	"backend/internal/models"
)

var validAccommodationDays = []string{"day0", "day1", "day2", "day3", "day4", "day5"}

// AdminListAccommodation returns users filtered by accommodation day and tab (incoming/outgoing/all).
func (a *API) AdminListAccommodation(c *gin.Context) {
	ctx := c.Request.Context()

	dayParam := strings.TrimSpace(c.Query("day"))
	tabType := strings.ToLower(strings.TrimSpace(c.Query("type")))
	search := strings.ToLower(strings.TrimSpace(c.Query("search")))

	if dayParam == "" {
		dayParam = "0"
	}
	dayIndex := 0
	trimmed := strings.TrimPrefix(dayParam, "day")
	if parsed, err := strconv.Atoi(trimmed); err == nil && parsed >= 0 && parsed <= 5 {
		dayIndex = parsed
	}
	targetDay := fmt.Sprintf("day%d", dayIndex)

	users, err := a.Store.ListAccommodationUsers(ctx)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load accommodation users"))
		return
	}

	type userResp struct {
		UserID              string               `json:"userId"`
		DisplayName         string               `json:"displayName"`
		Email               string               `json:"email"`
		PhoneNumber         string               `json:"phoneNumber"`
		CollegeName         string               `json:"collegeName"`
		AccommodationNeeded bool                 `json:"accommodationNeeded"`
		AccommodationStatus bool                 `json:"accommodationStatus"`
		FoodStatus          bool                 `json:"foodStatus"`
		Accommodation       map[string]bool      `json:"accommodation"`
		Food                map[string]bool      `json:"food"`
		CheckInStatus       models.CheckInStatus `json:"checkInStatus"`
	}

	result := make([]userResp, 0)

	for _, u := range users {
		acc := u.Accommodation
		if acc == nil {
			acc = make(map[string]bool)
		}
		food := u.Food
		if food == nil {
			food = make(map[string]bool)
		}

		accStatus := acc[targetDay]
		foodStatus := food[targetDay]

		if tabType == "incoming" {
			// Incoming: First day of booked stay (booked today, previous day not booked)
			if !acc[targetDay] {
				continue
			}
			if dayIndex > 0 {
				prevDay := fmt.Sprintf("day%d", dayIndex-1)
				if acc[prevDay] {
					continue
				}
			}
		} else if tabType == "outgoing" {
			// Outgoing: Previous day was booked, but today is NOT booked
			// (e.g. booked 20 Nov and 21 Nov -> on 22 Nov they need to leave and check out)
			if dayIndex == 0 {
				continue
			}
			prevDay := fmt.Sprintf("day%d", dayIndex-1)
			if !acc[prevDay] || acc[targetDay] {
				continue
			}
			// For outgoing users checking out of their stay, indicate their stay was booked
			accStatus = acc[prevDay]
			foodStatus = food[prevDay] || food[targetDay]
		} else {
			// Default / "all": user is staying on targetDay
			if !acc[targetDay] {
				continue
			}
		}

		// Apply search filter if provided
		if search != "" {
			name := strings.ToLower(u.DisplayName)
			email := strings.ToLower(u.Email)
			phone := strings.ToLower(u.PhoneNumber)
			college := strings.ToLower(u.CollegeName)
			hostel := strings.ToLower(u.CheckInStatus.Hostel)
			roomNo := strings.ToLower(u.CheckInStatus.RoomNo)

			if !strings.Contains(name, search) &&
				!strings.Contains(email, search) &&
				!strings.Contains(phone, search) &&
				!strings.Contains(college, search) &&
				!strings.Contains(hostel, search) &&
				!strings.Contains(roomNo, search) {
				continue
			}
		}

		result = append(result, userResp{
			UserID:              u.UserID,
			DisplayName:         u.DisplayName,
			Email:               u.Email,
			PhoneNumber:         u.PhoneNumber,
			CollegeName:         u.CollegeName,
			AccommodationNeeded: u.AccommodationNeeded,
			AccommodationStatus: accStatus,
			FoodStatus:          foodStatus,
			Accommodation:       acc,
			Food:                food,
			CheckInStatus:       u.CheckInStatus,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"users": result,
		"count": len(result),
	})
}

// AdminAccommodationStats returns accommodation totals, checked in, and pending for each day.
func (a *API) AdminAccommodationStats(c *gin.Context) {
	ctx := c.Request.Context()

	users, err := a.Store.ListAccommodationUsers(ctx)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load accommodation stats"))
		return
	}

	type dayStat struct {
		Day                string `json:"day"`
		Total              int    `json:"total"`
		CheckedIn          int    `json:"checkedIn"`
		CheckedOut         int    `json:"checkedOut"`
		Pending            int    `json:"pending"`
		IncomingTotal      int    `json:"incomingTotal"`
		IncomingCheckedIn  int    `json:"incomingCheckedIn"`
		IncomingPending    int    `json:"incomingPending"`
		OutgoingTotal      int    `json:"outgoingTotal"`
		OutgoingCheckedOut int    `json:"outgoingCheckedOut"`
		OutgoingPending    int    `json:"outgoingPending"`
	}

	stats := make([]dayStat, 6)
	for i := 0; i < 6; i++ {
		dayKey := fmt.Sprintf("day%d", i)
		total := 0
		checkedIn := 0
		checkedOut := 0

		incomingTotal := 0
		incomingCheckedIn := 0
		incomingPending := 0

		outgoingTotal := 0
		outgoingCheckedOut := 0
		outgoingPending := 0

		for _, u := range users {
			acc := u.Accommodation
			booked := acc != nil && acc[dayKey]
			// For day 5 (checkout day after last festival day 4), count users who stayed day 4
			if i == 5 && acc != nil && acc["day4"] {
				booked = true
			}
			if booked {
				total++
				if u.CheckInStatus.CheckedOut {
					checkedOut++
				} else if u.CheckInStatus.Accommodation {
					checkedIn++
				}
			}

			// Incoming on day i: First day of booked stay
			isIncoming := false
			if acc != nil && acc[dayKey] {
				if i == 0 || !acc[fmt.Sprintf("day%d", i-1)] {
					isIncoming = true
				}
			}
			if isIncoming {
				incomingTotal++
				if u.CheckInStatus.CheckedOut || u.CheckInStatus.Accommodation {
					incomingCheckedIn++
				} else {
					incomingPending++
				}
			}

			// Outgoing on day i: Previous day was booked, but today is NOT booked
			isOutgoing := false
			if i > 0 && acc != nil {
				if i == 5 {
					isOutgoing = acc["day4"]
				} else if acc[fmt.Sprintf("day%d", i-1)] && !acc[dayKey] {
					isOutgoing = true
				}
			}
			if isOutgoing {
				outgoingTotal++
				if u.CheckInStatus.CheckedOut {
					outgoingCheckedOut++
				} else {
					outgoingPending++
				}
			}
		}

		stats[i] = dayStat{
			Day:                strconv.Itoa(i),
			Total:              total,
			CheckedIn:          checkedIn,
			CheckedOut:         checkedOut,
			Pending:            total - checkedIn - checkedOut,
			IncomingTotal:      incomingTotal,
			IncomingCheckedIn:  incomingCheckedIn,
			IncomingPending:    incomingPending,
			OutgoingTotal:      outgoingTotal,
			OutgoingCheckedOut: outgoingCheckedOut,
			OutgoingPending:    outgoingPending,
		}
	}

	todayIdx := -1
	if !a.Cfg.FestDay0.IsZero() {
		todayIdx = festDayIndex(a.Cfg.FestDay0, a.clock())
	}
	todayDateStr := a.clock().In(config.IST).Format("2006-01-02")
	todayCheckedIn := 0
	todayCheckedOut := 0
	for _, u := range users {
		st := u.CheckInStatus
		if st.CheckedInAt != "" && strings.HasPrefix(st.CheckedInAt, todayDateStr) {
			todayCheckedIn++
		}
		if st.CheckedOutAt != "" && strings.HasPrefix(st.CheckedOutAt, todayDateStr) {
			todayCheckedOut++
		}
	}
	if todayIdx >= 0 && todayIdx < 6 {
		if todayCheckedIn == 0 && stats[todayIdx].CheckedIn > 0 {
			todayCheckedIn = stats[todayIdx].CheckedIn
		}
		if todayCheckedOut == 0 && stats[todayIdx].CheckedOut > 0 {
			todayCheckedOut = stats[todayIdx].CheckedOut
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"stats":           stats,
		"today":           todayIdx,
		"todayCheckedIn":  todayCheckedIn,
		"todayCheckedOut": todayCheckedOut,
	})
}

// festDayIndex counts IST calendar days since day0 (may be negative or past day4).
func festDayIndex(day0, now time.Time) int {
	n := now.In(config.IST)
	today := time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, config.IST)
	d0 := day0.In(config.IST)
	start := time.Date(d0.Year(), d0.Month(), d0.Day(), 0, 0, 0, 0, config.IST)
	return int(math.Round(today.Sub(start).Hours() / 24))
}

// lastStayDay returns the highest booked accommodation day index, or -1.
func lastStayDay(acc map[string]bool) int {
	last := -1
	for i := 0; i <= 5; i++ {
		if acc[fmt.Sprintf("day%d", i)] {
			last = i
		}
	}
	return last
}

func hospitalityRow(u *models.User) gin.H {
	return gin.H{
		"userId":        u.UserID,
		"displayName":   u.DisplayName,
		"email":         u.Email,
		"phoneNumber":   u.PhoneNumber,
		"collegeName":   u.CollegeName,
		"gender":        u.Gender,
		"accommodation": u.Accommodation,
		"food":          u.Food,
		"hostel":        u.CheckInStatus.Hostel,
		"roomNo":        u.CheckInStatus.RoomNo,
		"checkedInAt":   u.CheckInStatus.CheckedInAt,
		"checkInStatus": checkInStatusJSON(u.CheckInStatus),
		"unreturned":    u.CheckInStatus.Items.Unreturned(),
		"lastStayDay":   lastStayDay(u.Accommodation),
	}
}

// AdminInHouse lists participants currently checked into a hostel (EB only).
func (a *API) AdminInHouse(c *gin.Context) {
	hostel := strings.TrimSpace(c.Query("hostel"))
	users, err := a.Store.ListAccommodationUsers(c.Request.Context())
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load accommodation users"))
		return
	}
	out := make([]gin.H, 0)
	for _, u := range users {
		st := u.CheckInStatus
		if !st.Accommodation || st.CheckedOut {
			continue
		}
		if hostel != "" && st.Hostel != hostel {
			continue
		}
		out = append(out, hospitalityRow(u))
	}
	c.JSON(http.StatusOK, gin.H{"users": out, "count": len(out)})
}

// AdminCheckoutsToday lists participants whose stay ends today, i.e. whose
// last booked night was yesterday, and who have not checked out yet (EB only).
// ?day=N overrides today's fest-day index.
func (a *API) AdminCheckoutsToday(c *gin.Context) {
	today := -1
	if d := strings.TrimPrefix(strings.TrimSpace(c.Query("day")), "day"); d != "" {
		if n, err := strconv.Atoi(d); err == nil {
			today = n
		}
	} else if !a.Cfg.FestDay0.IsZero() {
		today = festDayIndex(a.Cfg.FestDay0, a.clock())
	}
	if today < 0 {
		apierr.Respond(c, apierr.BadRequest("not_fest_day", "today is not within the fest; pass ?day=N"))
		return
	}

	users, err := a.Store.ListAccommodationUsers(c.Request.Context())
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load accommodation users"))
		return
	}
	out := make([]gin.H, 0)
	for _, u := range users {
		if u.CheckInStatus.CheckedOut {
			continue
		}
		if lastStayDay(u.Accommodation)+1 != today {
			continue
		}
		out = append(out, hospitalityRow(u))
	}
	c.JSON(http.StatusOK, gin.H{"day": today, "users": out, "count": len(out)})
}
