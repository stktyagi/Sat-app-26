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

var validAccommodationDays = []string{"day0", "day1", "day2", "day3", "day4"}

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
	if parsed, err := strconv.Atoi(trimmed); err == nil && parsed >= 0 && parsed <= 4 {
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

		hasDay := acc[targetDay]
		if !hasDay {
			continue
		}

		// Filter by tab type: incoming or outgoing
		if tabType == "incoming" {
			// Incoming: First day of booked stay (previous day not booked)
			if dayIndex > 0 {
				prevDay := fmt.Sprintf("day%d", dayIndex-1)
				if acc[prevDay] {
					continue
				}
			}
		} else if tabType == "outgoing" {
			// Outgoing: Last day of booked stay (next day not booked)
			if dayIndex < 4 {
				nextDay := fmt.Sprintf("day%d", dayIndex+1)
				if acc[nextDay] {
					continue
				}
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
			AccommodationStatus: acc[targetDay],
			FoodStatus:          food[targetDay],
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
		Day       string `json:"day"`
		Total     int    `json:"total"`
		CheckedIn int    `json:"checkedIn"`
		Pending   int    `json:"pending"`
	}

	stats := make([]dayStat, 5)
	for i := 0; i < 5; i++ {
		dayKey := fmt.Sprintf("day%d", i)
		total := 0
		checkedIn := 0

		for _, u := range users {
			acc := u.Accommodation
			booked := acc != nil && acc[dayKey]
			if booked {
				total++
				if u.CheckInStatus.Accommodation {
					checkedIn++
				}
			}
		}

		stats[i] = dayStat{
			Day:       strconv.Itoa(i),
			Total:     total,
			CheckedIn: checkedIn,
			Pending:   total - checkedIn,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"stats": stats,
	})
}
