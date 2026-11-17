package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
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
		Day        string `json:"day"`
		Total      int    `json:"total"`
		CheckedIn  int    `json:"checkedIn"`
		CheckedOut int    `json:"checkedOut"`
		Pending    int    `json:"pending"`
	}

	stats := make([]dayStat, 6)
	for i := 0; i < 6; i++ {
		dayKey := fmt.Sprintf("day%d", i)
		total := 0
		checkedIn := 0
		checkedOut := 0

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
		}

		stats[i] = dayStat{
			Day:        strconv.Itoa(i),
			Total:      total,
			CheckedIn:  checkedIn,
			CheckedOut: checkedOut,
			Pending:    total - checkedIn - checkedOut,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"stats": stats,
	})
}
