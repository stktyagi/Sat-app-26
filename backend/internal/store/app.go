package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"strings"
	"cloud.google.com/go/firestore"

	"backend/internal/apierr"
	"backend/internal/isotime"
	"backend/internal/models"
)

var (
	appConfigMu      sync.RWMutex
	appConfigMemory  *models.AppConfig
	appConfigFileMod time.Time
)

func defaultAppAccommodation() models.AppAccommodation {
	return models.AppAccommodation{
		Amount:              600,
		Price:               600,
		TechnicalAmount:     600,
		CulturalAmount:      500,
		FoodAmount:          300,
		TechnicalFoodAmount: 200,
		CulturalFoodAmount:  300,
		TechnicalDays: map[string]int{
			"day0": 600, "day1": 600, "day2": 600, "day3": 600, "day4": 600,
		},
		CulturalDays: map[string]int{
			"day0": 500, "day1": 500, "day2": 500, "day3": 500, "day4": 500,
		},
		TechnicalFoodDays: map[string]int{
			"day0": 200, "day1": 200, "day2": 200, "day3": 200, "day4": 200,
		},
		CulturalFoodDays: map[string]int{
			"day0": 300, "day1": 300, "day2": 300, "day3": 300, "day4": 300,
		},
	}
}

func defaultAdminScreens() []models.AdminScreenConfig {
	return []models.AdminScreenConfig{
		{Key: "events_management", Label: "Event Management", Icon: "calendar-outline", Route: "/admin/EventsManagement", RequiredRoles: []string{models.RoleAdmin, models.RoleEBEvents, models.RoleEventPOC}},
		{Key: "qr_scanner", Label: "QR Scanner", Icon: "qr-code-outline", Route: "/admin/QRScanner", RequiredRoles: []string{models.RoleAdmin, models.RoleEBHospitality, models.RoleECHospitality, models.RoleCoreHospitality, models.RoleEBEvents, models.RoleEventPOC}},
		{Key: "venue_management", Label: "Venue Management", Icon: "location-outline", Route: "/admin/Venue", RequiredRoles: []string{models.RoleAdmin, models.RoleEBEvents}},
		{Key: "faq_management", Label: "FAQ Management", Icon: "help-circle-outline", Route: "/admin/FAQ", RequiredRoles: []string{models.RoleAdmin}},
		{Key: "accommodation", Label: "Accommodation", Icon: "bed-outline", Route: "/admin/Accommodation", RequiredRoles: []string{models.RoleAdmin, models.RoleEBHospitality, models.RoleECHospitality, models.RoleCoreHospitality}},
		{Key: "hospitality_eb", Label: "Hospitality Control", Icon: "business-outline", Route: "/admin/HospitalityEB", RequiredRoles: []string{models.RoleAdmin, models.RoleEBHospitality}},
		{Key: "meal_pass_qr", Label: "Meal Pass QR", Icon: "restaurant-outline", Route: "/admin/MealPassQR", RequiredRoles: []string{models.RoleAdmin, models.RoleEBHospitality, models.RoleECHospitality, models.RoleCoreHospitality}},
		{Key: "checkout_qr", Label: "Checkout QR", Icon: "log-out-outline", Route: "/admin/CheckoutQR", RequiredRoles: []string{models.RoleAdmin, models.RoleEBHospitality, models.RoleECHospitality, models.RoleCoreHospitality}},
		{Key: "users_management", Label: "Users Management", Icon: "people-outline", Route: "/admin/Users", RequiredRoles: []string{models.RoleAdmin, models.RoleEBEvents, models.RoleEBOutreach, models.RoleEBFinance, models.RoleEBHospitality}},
		{Key: "payment_management", Label: "Payment Management", Icon: "card-outline", Route: "/admin/Transactions", RequiredRoles: []string{models.RoleAdmin, models.RoleEBOutreach, models.RoleEBFinance}},
		{Key: "send_notification", Label: "Send Notification", Icon: "notifications-outline", Route: "/admin/SendNotification", RequiredRoles: []string{models.RoleAdmin}},
		{Key: "story_management", Label: "Story Management", Icon: "film-outline", Route: "/admin/StoryManagement", RequiredRoles: []string{models.RoleAdmin, models.RoleEBMedia}},
		{Key: "reel_management", Label: "Reel Management", Icon: "videocam-outline", Route: "/admin/ReelsManagement", RequiredRoles: []string{models.RoleAdmin, models.RoleEBMedia}},
		{Key: "banner_management", Label: "Banner Management", Icon: "image-outline", Route: "/admin/Banner", RequiredRoles: []string{models.RoleAdmin, models.RoleEBEvents, models.RoleEBMedia}},
		{Key: "app_config", Label: "App Configuration", Icon: "settings-outline", Route: "/admin/AppConfig", RequiredRoles: []string{models.RoleAdmin}},
	}
}

func defaultAppConfig() models.AppConfig {
	return models.AppConfig{
		Links: models.AppLinks{
			AppleStore: "https://apps.apple.com/app/saturnalia/id6738927814",
			PlayStore:  "https://play.google.com/store/apps/details?id=com.gauransh.saturnaliaapp2026",
		},
		Maintenance: models.AppMaintenance{
			Android: false,
			IOS:     false,
			Web:     false,
		},
		Versions: models.AppVersions{
			Android: "1.0.1",
			IOS:     "1.0.0",
		},
		Accommodation:       defaultAppAccommodation(),
		AdminScreens:        defaultAdminScreens(),
		UserMealPassScanner: true,
	}
}

func cloneMap(m map[string]int) map[string]int {
	if m == nil {
		return nil
	}
	out := make(map[string]int, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

func cloneAccommodation(a models.AppAccommodation) models.AppAccommodation {
	a.TechnicalDays = cloneMap(a.TechnicalDays)
	a.CulturalDays = cloneMap(a.CulturalDays)
	a.TechnicalFoodDays = cloneMap(a.TechnicalFoodDays)
	a.CulturalFoodDays = cloneMap(a.CulturalFoodDays)
	return a
}

func cloneAdminScreens(s []models.AdminScreenConfig) []models.AdminScreenConfig {
	if s == nil {
		return nil
	}
	out := make([]models.AdminScreenConfig, len(s))
	for i, item := range s {
		roles := make([]string, len(item.RequiredRoles))
		copy(roles, item.RequiredRoles)
		item.RequiredRoles = roles
		out[i] = item
	}
	return out
}

func cloneAppConfig(c models.AppConfig) models.AppConfig {
	c.Accommodation = cloneAccommodation(c.Accommodation)
	c.AdminScreens = cloneAdminScreens(c.AdminScreens)
	return c
}

func (s *Store) configPath() string {
	if s != nil && s.Cfg != nil && s.Cfg.AppConfigFile != "" {
		return s.Cfg.AppConfigFile
	}
	if p := os.Getenv("APP_CONFIG_FILE"); p != "" {
		return p
	}
	return "app_config.json"
}

func (s *Store) loadAppConfigLocked() (*models.AppConfig, error) {
	filePath := s.configPath()

	stat, err := os.Stat(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			cfg := defaultAppConfig()
			appConfigMemory = &cfg
			if saveErr := saveAppConfigLocked(filePath, &cfg); saveErr != nil {
				log.Printf("[store/app] warning: could not create default %s: %v", filePath, saveErr)
			} else {
				if fi, statErr := os.Stat(filePath); statErr == nil {
					appConfigFileMod = fi.ModTime()
				}
				log.Printf("[store/app] initialized default configuration at %s", filePath)
			}
			return appConfigMemory, nil
		}
		if appConfigMemory != nil {
			return appConfigMemory, nil
		}
		cfg := defaultAppConfig()
		appConfigMemory = &cfg
		return appConfigMemory, nil
	}

	if appConfigMemory != nil && stat.ModTime().Equal(appConfigFileMod) {
		return appConfigMemory, nil
	}

	bytes, err := os.ReadFile(filePath)
	if err != nil {
		if appConfigMemory != nil {
			return appConfigMemory, nil
		}
		cfg := defaultAppConfig()
		appConfigMemory = &cfg
		return appConfigMemory, nil
	}

	var parsed models.AppConfig
	if err := json.Unmarshal(bytes, &parsed); err != nil {
		log.Printf("[store/app] error parsing %s: %v; falling back to memory/defaults", filePath, err)
		if appConfigMemory != nil {
			return appConfigMemory, nil
		}
		cfg := defaultAppConfig()
		appConfigMemory = &cfg
		return appConfigMemory, nil
	}

	if parsed.Accommodation.Amount <= 0 && parsed.Accommodation.Price > 0 {
		parsed.Accommodation.Amount = parsed.Accommodation.Price
	}
	if parsed.Accommodation.Amount <= 0 {
		parsed.Accommodation.Amount = 600
	}
	if parsed.Accommodation.Price <= 0 {
		parsed.Accommodation.Price = parsed.Accommodation.Amount
	}
	if parsed.Accommodation.FoodAmount <= 0 {
		parsed.Accommodation.FoodAmount = 300
	}
	if len(parsed.AdminScreens) == 0 {
		parsed.AdminScreens = defaultAdminScreens()
	} else {
		parsed.AdminScreens = mergeDefaultScreens(parsed.AdminScreens)
	}

	appConfigMemory = &parsed
	appConfigFileMod = stat.ModTime()
	return appConfigMemory, nil
}

// mergeDefaultScreens adds default screens missing from a persisted list and
// unions each default's roles into the persisted entry, so new screens and
// newly introduced roles show up without hand-editing the config file.
func mergeDefaultScreens(screens []models.AdminScreenConfig) []models.AdminScreenConfig {
	out := cloneAdminScreens(screens)
	idx := make(map[string]int, len(out))
	for i, sc := range out {
		idx[sc.Key] = i
	}
	for _, def := range defaultAdminScreens() {
		i, ok := idx[def.Key]
		if !ok {
			out = append(out, def)
			continue
		}
		have := make(map[string]bool, len(out[i].RequiredRoles))
		for _, r := range out[i].RequiredRoles {
			have[models.NormalizeRole(r)] = true
		}
		for _, r := range def.RequiredRoles {
			if !have[r] {
				out[i].RequiredRoles = append(out[i].RequiredRoles, r)
			}
		}
	}
	return out
}

func saveAppConfigLocked(filePath string, cfg *models.AppConfig) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal app config: %w", err)
	}

	dir := filepath.Dir(filePath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("create config dir %s: %w", dir, err)
		}
	}

	tmpFile := filePath + ".tmp"
	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		return fmt.Errorf("write tmp config file %s: %w", tmpFile, err)
	}

	if err := os.Rename(tmpFile, filePath); err != nil {
		return fmt.Errorf("rename tmp config to %s: %w", filePath, err)
	}

	if fi, err := os.Stat(filePath); err == nil {
		appConfigFileMod = fi.ModTime()
	}
	return nil
}

// InvalidateAppConfigCache forces a reload from disk on next read.
func (s *Store) InvalidateAppConfigCache() {
	appConfigMu.Lock()
	defer appConfigMu.Unlock()
	appConfigMemory = nil
	appConfigFileMod = time.Time{}
}

// GetAppConfig retrieves links, maintenance, versions, and accommodation from server memory / JSON file.
func (s *Store) GetAppConfig(ctx context.Context) (*models.AppConfig, error) {
	appConfigMu.Lock()
	defer appConfigMu.Unlock()

	cfg, err := s.loadAppConfigLocked()
	if err != nil {
		return nil, err
	}
	copied := cloneAppConfig(*cfg)
	return &copied, nil
}

// GetAppLinks fetches the app store / play store links.
func (s *Store) GetAppLinks(ctx context.Context) (*models.AppLinks, error) {
	cfg, err := s.GetAppConfig(ctx)
	if err != nil {
		return nil, err
	}
	return &cfg.Links, nil
}

// GetAppMaintenance fetches the platform maintenance status.
func (s *Store) GetAppMaintenance(ctx context.Context) (*models.AppMaintenance, error) {
	cfg, err := s.GetAppConfig(ctx)
	if err != nil {
		return nil, err
	}
	return &cfg.Maintenance, nil
}

// GetAppVersions fetches the platform minimum versions.
func (s *Store) GetAppVersions(ctx context.Context) (*models.AppVersions, error) {
	cfg, err := s.GetAppConfig(ctx)
	if err != nil {
		return nil, err
	}
	return &cfg.Versions, nil
}

// GetAppAccommodation fetches the dynamic accommodation pricing.
func (s *Store) GetAppAccommodation(ctx context.Context) (*models.AppAccommodation, error) {
	cfg, err := s.GetAppConfig(ctx)
	if err != nil {
		return nil, err
	}
	return &cfg.Accommodation, nil
}

// SetAppLinks updates the app store / play store links and persists to JSON.
func (s *Store) SetAppLinks(ctx context.Context, links *models.AppLinks) error {
	if links == nil {
		return fmt.Errorf("links cannot be nil")
	}
	appConfigMu.Lock()
	defer appConfigMu.Unlock()

	cfg, err := s.loadAppConfigLocked()
	if err != nil {
		return err
	}
	cfg.Links = *links
	return saveAppConfigLocked(s.configPath(), cfg)
}

// SetAppMaintenance updates platform maintenance status and persists to JSON.
func (s *Store) SetAppMaintenance(ctx context.Context, m *models.AppMaintenance) error {
	if m == nil {
		return fmt.Errorf("maintenance cannot be nil")
	}
	appConfigMu.Lock()
	defer appConfigMu.Unlock()

	cfg, err := s.loadAppConfigLocked()
	if err != nil {
		return err
	}
	cfg.Maintenance = *m
	return saveAppConfigLocked(s.configPath(), cfg)
}

// SetAppVersions updates platform minimum versions and persists to JSON.
func (s *Store) SetAppVersions(ctx context.Context, v *models.AppVersions) error {
	if v == nil {
		return fmt.Errorf("versions cannot be nil")
	}
	appConfigMu.Lock()
	defer appConfigMu.Unlock()

	cfg, err := s.loadAppConfigLocked()
	if err != nil {
		return err
	}
	cfg.Versions = *v
	return saveAppConfigLocked(s.configPath(), cfg)
}

// SetAppAccommodation updates accommodation pricing and persists to JSON.
func (s *Store) SetAppAccommodation(ctx context.Context, a *models.AppAccommodation) error {
	if a == nil {
		return fmt.Errorf("accommodation cannot be nil")
	}
	appConfigMu.Lock()
	defer appConfigMu.Unlock()

	cfg, err := s.loadAppConfigLocked()
	if err != nil {
		return err
	}
	if a.Amount <= 0 && a.Price > 0 {
		a.Amount = a.Price
	}
	if a.Price <= 0 && a.Amount > 0 {
		a.Price = a.Amount
	}
	cfg.Accommodation = cloneAccommodation(*a)
	return saveAppConfigLocked(s.configPath(), cfg)
}

// EnsureAppDefaults initializes the app configuration from JSON file or hardcoded defaults.
func (s *Store) EnsureAppDefaults(ctx context.Context) error {
	appConfigMu.Lock()
	defer appConfigMu.Unlock()

	_, err := s.loadAppConfigLocked()
	return err
}

// GetAdminScreens fetches the admin screen role mappings.
func (s *Store) GetAdminScreens(ctx context.Context) ([]models.AdminScreenConfig, error) {
	cfg, err := s.GetAppConfig(ctx)
	if err != nil {
		return nil, err
	}
	if len(cfg.AdminScreens) == 0 {
		return defaultAdminScreens(), nil
	}
	return cfg.AdminScreens, nil
}

// SetAdminScreens updates the admin screen role mappings and persists to JSON.
func (s *Store) SetAdminScreens(ctx context.Context, screens []models.AdminScreenConfig) error {
	if screens == nil {
		return fmt.Errorf("screens cannot be nil")
	}
	appConfigMu.Lock()
	defer appConfigMu.Unlock()

	cfg, err := s.loadAppConfigLocked()
	if err != nil {
		return err
	}
	cfg.AdminScreens = cloneAdminScreens(screens)
	return saveAppConfigLocked(s.configPath(), cfg)
}

// GetUserMealPassScanner returns whether the user meal pass scanner is active.
func (s *Store) GetUserMealPassScanner(ctx context.Context) (bool, error) {
	appConfigMu.RLock()
	defer appConfigMu.RUnlock()

	cfg, err := s.loadAppConfigLocked()
	if err != nil {
		return false, err
	}
	return cfg.UserMealPassScanner, nil
}

// SetUserMealPassScanner updates whether the user meal pass scanner is active and persists to JSON.
func (s *Store) SetUserMealPassScanner(ctx context.Context, enabled bool) error {
	appConfigMu.Lock()
	defer appConfigMu.Unlock()

	cfg, err := s.loadAppConfigLocked()
	if err != nil {
		return err
	}
	cfg.UserMealPassScanner = enabled
	return saveAppConfigLocked(s.configPath(), cfg)
}

// UserCanAccessScreen checks if the user has permission to access a screen by key or route.
// Administrators always have full access.
func (s *Store) UserCanAccessScreen(ctx context.Context, u *models.User, screenKey string) bool {
	if u == nil {
		return false
	}
	if u.IsAdmin() {
		return true
	}
	screens, err := s.GetAdminScreens(ctx)
	if err != nil {
		return false
	}
	for _, sc := range screens {
		if strings.EqualFold(sc.Key, screenKey) || strings.EqualFold(sc.Route, screenKey) {
			return u.HasAnyRole(sc.RequiredRoles...)
		}
	}
	return false
}


var (
	availMu        sync.RWMutex
	availCache     *models.AccommodationAvailabilityDoc
	availCacheTime time.Time
	availTTL       = 1 * time.Second
)

func (s *Store) InvalidateAccommodationAvailabilityCache() {
	availMu.Lock()
	defer availMu.Unlock()
	availCache = nil
	if s.Cache != nil {
		_ = s.Cache.Delete(context.Background(), KeyAccommodationAvailability)
	}
}

// GetAccommodationAvailability retrieves the counter document.
// Order of priority:
// 1. In-memory cache (instant)
// 2. Redis cache (0 Firestore reads)
// 3. Firestore document app/accommodation_availability (only on cold cache/restart)
func (s *Store) GetAccommodationAvailability(ctx context.Context) (*models.AccommodationAvailabilityDoc, error) {
	availMu.RLock()
	if availCache != nil && time.Since(availCacheTime) < availTTL {
		cached := availCache
		availMu.RUnlock()
		return cached, nil
	}
	availMu.RUnlock()

	availMu.Lock()
	defer availMu.Unlock()

	if availCache != nil && time.Since(availCacheTime) < availTTL {
		return availCache, nil
	}

	// 1. Check Redis first to avoid Firestore reads completely
	if s.Cache != nil {
		if raw, err := s.Cache.Get(ctx, KeyAccommodationAvailability); err == nil && len(raw) > 0 {
			var data models.AccommodationAvailabilityDoc
			if err := json.Unmarshal(raw, &data); err == nil {
				availCache = &data
				availCacheTime = time.Now()
				return availCache, nil
			}
		}
	}

	if s.FS == nil {
		return &models.AccommodationAvailabilityDoc{}, nil
	}

	doc, err := s.FS.Collection(ColApp).Doc("accommodation_availability").Get(ctx)
	if err != nil {
		if errors.Is(wrap(err), ErrNotFound) {
			return s.reconcileAccommodationAvailabilityLocked(ctx)
		}
		return nil, err
	}

	var data models.AccommodationAvailabilityDoc
	if err := doc.DataTo(&data); err != nil {
		return nil, err
	}

	// Populate Redis
	if s.Cache != nil {
		if b, err := json.Marshal(data); err == nil {
			_ = s.Cache.Set(ctx, KeyAccommodationAvailability, b, 0)
		}
	}

	availCache = &data
	availCacheTime = time.Now()
	return availCache, nil
}

// ReconcileAccommodationAvailability recalculates counts by querying the users collection
// and updates app/accommodation_availability.
func (s *Store) ReconcileAccommodationAvailability(ctx context.Context) (*models.AccommodationAvailabilityDoc, error) {
	availMu.Lock()
	defer availMu.Unlock()
	return s.reconcileAccommodationAvailabilityLocked(ctx)
}

func (s *Store) reconcileAccommodationAvailabilityLocked(ctx context.Context) (*models.AccommodationAvailabilityDoc, error) {
	if s.FS == nil {
		return &models.AccommodationAvailabilityDoc{}, nil
	}

	iter := s.FS.Collection(ColUsers).WhereEntity(firestore.OrFilter{
		Filters: []firestore.EntityFilter{
			firestore.PropertyFilter{Path: "accommodation.day0", Operator: "==", Value: true},
			firestore.PropertyFilter{Path: "accommodation.day1", Operator: "==", Value: true},
			firestore.PropertyFilter{Path: "accommodation.day2", Operator: "==", Value: true},
			firestore.PropertyFilter{Path: "accommodation.day3", Operator: "==", Value: true},
			firestore.PropertyFilter{Path: "accommodation.day4", Operator: "==", Value: true},
		},
	}).Documents(ctx)
	defer iter.Stop()

	var doc models.AccommodationAvailabilityDoc
	for {
		snap, err := iter.Next()
		if err != nil {
			break
		}
		var u models.User
		if err := snap.DataTo(&u); err != nil {
			continue
		}
		if u.Accommodation == nil {
			continue
		}

		gender := models.NormalizeGender(u.Gender)
		isFemale := gender == "female"

		if u.Accommodation["day0"] {
			if isFemale { doc.Day0.Female++ } else { doc.Day0.Male++ }
		}
		if u.Accommodation["day1"] {
			if isFemale { doc.Day1.Female++ } else { doc.Day1.Male++ }
		}
		if u.Accommodation["day2"] {
			if isFemale { doc.Day2.Female++ } else { doc.Day2.Male++ }
		}
		if u.Accommodation["day3"] {
			if isFemale { doc.Day3.Female++ } else { doc.Day3.Male++ }
		}
		if u.Accommodation["day4"] {
			if isFemale { doc.Day4.Female++ } else { doc.Day4.Male++ }
		}
	}

	doc.UpdatedAt = isotime.Now()
	_, err := s.FS.Collection(ColApp).Doc("accommodation_availability").Set(ctx, doc)
	if err != nil {
		log.Printf("error saving accommodation_availability: %v", err)
	}

	// Update Redis cache directly
	if s.Cache != nil {
		if b, err := json.Marshal(doc); err == nil {
			_ = s.Cache.Set(ctx, KeyAccommodationAvailability, b, 0)
		}
	}

	availCache = &doc
	availCacheTime = time.Now()
	return &doc, nil
}

// CheckAccommodationCapacity validates that requested days do not exceed capacity for the user's gender.
func (s *Store) CheckAccommodationCapacity(ctx context.Context, requestedDays map[string]any, gender string, user *models.User) error {
	avail, err := s.GetAccommodationAvailability(ctx)
	if err != nil {
		log.Printf("CheckAccommodationCapacity: error getting availability: %v", err)
		return nil
	}

	gender = models.NormalizeGender(gender)
	isFemale := gender == "female"
	limit := models.MaxMaleAccommodation
	if isFemale {
		limit = models.MaxFemaleAccommodation
	}

	checkDay := func(day string, bookedCount int) error {
		if user != nil && user.Accommodation != nil && user.Accommodation[day] {
			return nil
		}
		if bookedCount+1 > limit {
			return apierr.BadRequest("accommodation_sold_out", fmt.Sprintf("Accommodation is sold out for %s", day))
		}
		return nil
	}

	for day, v := range requestedDays {
		on, _ := v.(bool)
		if !on {
			continue
		}
		switch day {
		case "day0":
			count := avail.Day0.Male
			if isFemale { count = avail.Day0.Female }
			if err := checkDay("day0", count); err != nil { return err }
		case "day1":
			count := avail.Day1.Male
			if isFemale { count = avail.Day1.Female }
			if err := checkDay("day1", count); err != nil { return err }
		case "day2":
			count := avail.Day2.Male
			if isFemale { count = avail.Day2.Female }
			if err := checkDay("day2", count); err != nil { return err }
		case "day3":
			count := avail.Day3.Male
			if isFemale { count = avail.Day3.Female }
			if err := checkDay("day3", count); err != nil { return err }
		case "day4":
			count := avail.Day4.Male
			if isFemale { count = avail.Day4.Female }
			if err := checkDay("day4", count); err != nil { return err }
		}
	}
	return nil
}
