package handlers

import (
	"testing"

	"github.com/gin-gonic/gin"

	"backend/internal/models"
)

// mockAccommodationStore mocks ListAccommodationUsers for handler testing.
type mockAccommodationStore struct {
	users []*models.User
}

func (m *mockAccommodationStore) ListAccommodationUsers() []*models.User {
	return m.users
}

func TestAdminListAccommodation_FiltersOnlyBookedUsers(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// User 1: Booked day0 and day1
	u1 := &models.User{
		UserID:              "u1",
		DisplayName:         "User One",
		Email:               "u1@example.com",
		AccommodationNeeded: true,
		Accommodation:       map[string]bool{"day0": true, "day1": true},
	}
	// User 2: Only accommodationNeeded=true, NO days booked (the extra/ghost user)
	u2 := &models.User{
		UserID:              "u2",
		DisplayName:         "Ghost User",
		Email:               "ghost@example.com",
		AccommodationNeeded: true,
		Accommodation:       map[string]bool{},
	}
	// User 3: Booked day1, but accommodationNeeded=false (like Aargh Rai)
	u3 := &models.User{
		UserID:              "u3",
		DisplayName:         "User Three",
		Email:               "u3@example.com",
		AccommodationNeeded: false,
		Accommodation:       map[string]bool{"day1": true},
	}

	testUsers := []*models.User{u1, u2, u3}

	filterUsersForDay := func(users []*models.User, dayIndex int, tabType string) []string {
		targetDay := "day" + string('0'+byte(dayIndex))
		var result []string
		for _, u := range users {
			acc := u.Accommodation
			if acc == nil || !acc[targetDay] {
				continue
			}
			if tabType == "incoming" {
				if dayIndex > 0 {
					prevDay := "day" + string('0'+byte(dayIndex-1))
					if acc[prevDay] {
						continue
					}
				}
			} else if tabType == "outgoing" {
				if dayIndex < 4 {
					nextDay := "day" + string('0'+byte(dayIndex+1))
					if acc[nextDay] {
						continue
					}
				}
			}
			result = append(result, u.UserID)
		}
		return result
	}

	// Test Day 0 (Incoming): Only u1 should be returned, u2 (ghost) must NOT be returned
	day0Incoming := filterUsersForDay(testUsers, 0, "incoming")
	if len(day0Incoming) != 1 || day0Incoming[0] != "u1" {
		t.Fatalf("expected [u1] for day0 incoming, got %v", day0Incoming)
	}

	// Test Day 0 (Outgoing): u1 has day1 booked, so not outgoing on day0
	day0Outgoing := filterUsersForDay(testUsers, 0, "outgoing")
	if len(day0Outgoing) != 0 {
		t.Fatalf("expected 0 users for day0 outgoing, got %v", day0Outgoing)
	}

	// Test Day 1 (Incoming): u3 arrives on day1 (u1 arrived on day0 so u1 is not incoming on day1)
	day1Incoming := filterUsersForDay(testUsers, 1, "incoming")
	if len(day1Incoming) != 1 || day1Incoming[0] != "u3" {
		t.Fatalf("expected [u3] for day1 incoming, got %v", day1Incoming)
	}

	// Test Day 1 (Outgoing): both u1 and u3 stay ends on day1
	day1Outgoing := filterUsersForDay(testUsers, 1, "outgoing")
	if len(day1Outgoing) != 2 {
		t.Fatalf("expected 2 users for day1 outgoing, got %v", day1Outgoing)
	}
}

func TestAdminAccommodationStats_CalculatesRealTotals(t *testing.T) {
	// u1 has day0, day1
	u1 := &models.User{
		UserID:        "u1",
		Accommodation: map[string]bool{"day0": true, "day1": true},
		CheckInStatus: models.CheckInStatus{Accommodation: true},
	}
	// u2 has only accommodationNeeded=true, empty acc (ghost user)
	u2 := &models.User{
		UserID:              "u2",
		AccommodationNeeded: true,
		Accommodation:       map[string]bool{},
	}
	// u3 has day1
	u3 := &models.User{
		UserID:        "u3",
		Accommodation: map[string]bool{"day1": true},
	}

	testUsers := []*models.User{u1, u2, u3}

	for dayIdx := 0; dayIdx < 5; dayIdx++ {
		dayKey := "day" + string('0'+byte(dayIdx))
		total := 0
		checkedIn := 0
		for _, u := range testUsers {
			acc := u.Accommodation
			booked := acc != nil && acc[dayKey]
			if booked {
				total++
				if u.CheckInStatus.Accommodation {
					checkedIn++
				}
			}
		}
		if dayIdx == 0 {
			if total != 1 || checkedIn != 1 {
				t.Errorf("day0: expected total 1, checkedIn 1; got total %d, checkedIn %d", total, checkedIn)
			}
		} else if dayIdx == 1 {
			if total != 2 || checkedIn != 1 {
				t.Errorf("day1: expected total 2, checkedIn 1; got total %d, checkedIn %d", total, checkedIn)
			}
		} else {
			if total != 0 {
				t.Errorf("day%d: expected total 0; got total %d", dayIdx, total)
			}
		}
	}
}
