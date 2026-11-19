package models

import "strings"

// Hostel is an EB-managed accommodation block. Occupied counts users currently
// allotted to it who have not checked out.
type Hostel struct {
	ID        string `json:"id"        firestore:"-"`
	Name      string `json:"name"      firestore:"name"`
	Gender    string `json:"gender"    firestore:"gender"` // male | female | any
	Capacity  int    `json:"capacity"  firestore:"capacity"`
	Occupied  int    `json:"occupied"  firestore:"occupied"`
	Active    bool   `json:"active"    firestore:"active"`
	CreatedAt string `json:"createdAt" firestore:"createdAt"`
	UpdatedAt string `json:"updatedAt" firestore:"updatedAt"`
}

func (h *Hostel) Remaining() int {
	if r := h.Capacity - h.Occupied; r > 0 {
		return r
	}
	return 0
}

// NormalizeHostelGender maps free-form input to male | female | any.
func NormalizeHostelGender(g string) string {
	switch strings.ToLower(strings.TrimSpace(g)) {
	case "", "any", "all", "mixed", "both":
		return "any"
	}
	return NormalizeGender(g)
}

// AcceptsGender reports whether a user of the given gender can be housed here.
func (h *Hostel) AcceptsGender(userGender string) bool {
	return h.Gender == "any" || h.Gender == "" || h.Gender == NormalizeGender(userGender)
}

// Meal slots in IST. A paid food day covers every slot.
type MealSlot struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Start string `json:"start"` // HH:MM
	End   string `json:"end"`   // HH:MM, exclusive
}

var MealSlots = []MealSlot{
	{Key: "breakfast", Label: "Breakfast", Start: "07:00", End: "10:30"},
	{Key: "lunch", Label: "Lunch", Start: "12:00", End: "15:30"},
	{Key: "dinner", Label: "Dinner", Start: "19:00", End: "22:30"},
}

func IsMealSlot(k string) bool {
	for _, s := range MealSlots {
		if s.Key == k {
			return true
		}
	}
	return false
}

// MealLog records one availed meal. The document id is {day}_{slot}_{uid}, so a
// user can avail each slot once.
type MealLog struct {
	UserID     string `json:"userId"     firestore:"userId"`
	Name       string `json:"name"       firestore:"name"`
	Email      string `json:"email"      firestore:"email"`
	Phone      string `json:"phone"      firestore:"phone"`
	College    string `json:"college"    firestore:"college"`
	Gender     string `json:"gender"     firestore:"gender"`
	Day        string `json:"day"        firestore:"day"`
	Slot       string `json:"slot"       firestore:"slot"`
	At         string `json:"at"         firestore:"at"`
	Method     string `json:"method"     firestore:"method"` // qr | code
	VerifiedBy string `json:"verifiedBy" firestore:"verifiedBy"`
}
