package models

import "strings"

// AppLinks contains store links for Android (Play Store) and iOS (App Store).
type AppLinks struct {
	AppleStore string `json:"appleStore" firestore:"appleStore"`
	PlayStore  string `json:"playStore"  firestore:"playStore"`
}

// AppMaintenance holds boolean maintenance flags per platform.
type AppMaintenance struct {
	Android bool `json:"android" firestore:"android"`
	IOS     bool `json:"ios"     firestore:"ios"`
	Web     bool `json:"web"     firestore:"web"`
}

// AppVersions holds the current minimum required versions for version check.
type AppVersions struct {
	Android string `json:"android" firestore:"android"`
	IOS     string `json:"ios"     firestore:"ios"`
}

// AppAccommodation holds dynamic accommodation and food pass pricing.
type AppAccommodation struct {
	Amount              int `json:"amount" firestore:"amount"`
	Price               int `json:"price,omitempty" firestore:"price,omitempty"`
	TechnicalAmount     int `json:"technicalAmount,omitempty" firestore:"technicalAmount,omitempty"`
	CulturalAmount      int `json:"culturalAmount,omitempty" firestore:"culturalAmount,omitempty"`
	FoodAmount          int `json:"foodAmount,omitempty" firestore:"foodAmount,omitempty"`
	TechnicalFoodAmount int `json:"technicalFoodAmount,omitempty" firestore:"technicalFoodAmount,omitempty"`
	CulturalFoodAmount  int `json:"culturalFoodAmount,omitempty" firestore:"culturalFoodAmount,omitempty"`

	// Per-day prices keyed by day ("day0".."day4"). A missing day falls back
	// to the flat amount for its category.
	TechnicalDays     map[string]int `json:"technicalDays,omitempty" firestore:"technicalDays,omitempty"`
	CulturalDays      map[string]int `json:"culturalDays,omitempty" firestore:"culturalDays,omitempty"`
	TechnicalFoodDays map[string]int `json:"technicalFoodDays,omitempty" firestore:"technicalFoodDays,omitempty"`
	CulturalFoodDays  map[string]int `json:"culturalFoodDays,omitempty" firestore:"culturalFoodDays,omitempty"`
}

// AdminScreenConfig defines an admin panel screen and the roles authorized to view it.
type AdminScreenConfig struct {
	Key           string   `json:"key"           firestore:"key"`
	Label         string   `json:"label"         firestore:"label"`
	Icon          string   `json:"icon"          firestore:"icon"`
	Route         string   `json:"route"         firestore:"route"`
	RequiredRoles []string `json:"requiredRoles" firestore:"requiredRoles"`
}

// AppConfig is the combined configuration object containing links, maintenance, versions, accommodation pricing, and admin screen permissions.
type AppConfig struct {
	Links         AppLinks            `json:"links"`
	Maintenance   AppMaintenance      `json:"maintenance"`
	Versions      AppVersions         `json:"versions"`
	Accommodation AppAccommodation    `json:"accommodation"`
	AdminScreens  []AdminScreenConfig `json:"adminScreens,omitempty"`
}

const (
	MaxMaleAccommodation   = 300
	MaxFemaleAccommodation = 130
)

type DayAvailability struct {
	Male   int `json:"male"   firestore:"male"`
	Female int `json:"female" firestore:"female"`
}

type AccommodationAvailabilityDoc struct {
	Day0      DayAvailability `json:"day0"      firestore:"day0"`
	Day1      DayAvailability `json:"day1"      firestore:"day1"`
	Day2      DayAvailability `json:"day2"      firestore:"day2"`
	Day3      DayAvailability `json:"day3"      firestore:"day3"`
	Day4      DayAvailability `json:"day4"      firestore:"day4"`
	UpdatedAt string          `json:"updatedAt" firestore:"updatedAt"`
}

type DayRemaining struct {
	Remaining int  `json:"remaining"`
	Total     int  `json:"total"`
	IsSoldOut bool `json:"isSoldOut"`
}

func NormalizeGender(g string) string {
	lower := strings.ToLower(strings.TrimSpace(g))
	if strings.HasPrefix(lower, "f") || strings.Contains(lower, "female") {
		return "female"
	}
	return "male"
}
