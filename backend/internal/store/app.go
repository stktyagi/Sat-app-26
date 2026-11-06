package store

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

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
		Accommodation: defaultAppAccommodation(),
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

func cloneAppConfig(c models.AppConfig) models.AppConfig {
	c.Accommodation = cloneAccommodation(c.Accommodation)
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

	appConfigMemory = &parsed
	appConfigFileMod = stat.ModTime()
	return appConfigMemory, nil
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
