package models

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
	Amount          int `json:"amount" firestore:"amount"`
	Price           int `json:"price,omitempty" firestore:"price,omitempty"`
	TechnicalAmount int `json:"technicalAmount,omitempty" firestore:"technicalAmount,omitempty"`
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

// AppConfig is the combined configuration object containing links, maintenance, versions, and accommodation pricing.
type AppConfig struct {
	Links         AppLinks         `json:"links"`
	Maintenance   AppMaintenance   `json:"maintenance"`
	Versions      AppVersions      `json:"versions"`
	Accommodation AppAccommodation `json:"accommodation"`
}
