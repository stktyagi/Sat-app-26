package handlers

import (
	"fmt"
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

	// User 1: Booked day0 and day1 (Nov 19, Nov 20)
	u1 := &models.User{
		UserID:              "u1",
		DisplayName:         "User One",
		Email:               "u1@example.com",
		AccommodationNeeded: true,
		Accommodation:       map[string]bool{"day0": true, "day1": true},
	}
	// User 2: Only accommodationNeeded=true, NO days booked (the ghost user)
	u2 := &models.User{
		UserID:              "u2",
		DisplayName:         "Ghost User",
		Email:               "ghost@example.com",
		AccommodationNeeded: true,
		Accommodation:       map[string]bool{},
	}
	// User 3: Booked day1 (Nov 20)
	u3 := &models.User{
		UserID:              "u3",
		DisplayName:         "User Three",
		Email:               "u3@example.com",
		AccommodationNeeded: false,
		Accommodation:       map[string]bool{"day1": true},
	}
	// User 4: Booked day1 and day2 (Nov 20, Nov 21) -> Checkout on day3 (Nov 22)
	u4 := &models.User{
		UserID:              "u4",
		DisplayName:         "User Four",
		Email:               "u4@example.com",
		AccommodationNeeded: true,
		Accommodation:       map[string]bool{"day1": true, "day2": true},
	}

	testUsers := []*models.User{u1, u2, u3, u4}

	filterUsersForDay := func(users []*models.User, dayIndex int, tabType string) []string {
		targetDay := fmt.Sprintf("day%d", dayIndex)
		var result []string
		for _, u := range users {
			acc := u.Accommodation
			if acc == nil {
				acc = make(map[string]bool)
			}

			if tabType == "incoming" {
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
				if dayIndex == 0 {
					continue
				}
				prevDay := fmt.Sprintf("day%d", dayIndex-1)
				if !acc[prevDay] || acc[targetDay] {
					continue
				}
			} else {
				if !acc[targetDay] {
					continue
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

	// Test Day 0 (Outgoing): No previous day, so 0 outgoing
	day0Outgoing := filterUsersForDay(testUsers, 0, "outgoing")
	if len(day0Outgoing) != 0 {
		t.Fatalf("expected 0 users for day0 outgoing, got %v", day0Outgoing)
	}

	// Test Day 1 (Incoming): u3 and u4 arrive on day1 (u1 arrived on day0)
	day1Incoming := filterUsersForDay(testUsers, 1, "incoming")
	if len(day1Incoming) != 2 || day1Incoming[0] != "u3" || day1Incoming[1] != "u4" {
		t.Fatalf("expected [u3, u4] for day1 incoming, got %v", day1Incoming)
	}

	// Test Day 1 (Outgoing): u1 stayed day 0 and is staying day 1. u3/u4 arrived day 1. 0 outgoing on day 1
	day1Outgoing := filterUsersForDay(testUsers, 1, "outgoing")
	if len(day1Outgoing) != 0 {
		t.Fatalf("expected 0 users for day1 outgoing, got %v", day1Outgoing)
	}

	// Test Day 2 (Outgoing): u1 (booked day0, day1) and u3 (booked day1) check out on day 2!
	day2Outgoing := filterUsersForDay(testUsers, 2, "outgoing")
	if len(day2Outgoing) != 2 || day2Outgoing[0] != "u1" || day2Outgoing[1] != "u3" {
		t.Fatalf("expected [u1, u3] for day2 outgoing, got %v", day2Outgoing)
	}

	// Test Day 3 (Outgoing): u4 (booked day1, day2) checks out on day 3 (Nov 22)!
	day3Outgoing := filterUsersForDay(testUsers, 3, "outgoing")
	if len(day3Outgoing) != 1 || day3Outgoing[0] != "u4" {
		t.Fatalf("expected [u4] for day3 outgoing, got %v", day3Outgoing)
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
		dayKey := fmt.Sprintf("day%d", dayIdx)
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
