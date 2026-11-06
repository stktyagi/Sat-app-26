package store

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"backend/internal/config"
	"backend/internal/models"
)

func TestAppConfigJSONPersistence(t *testing.T) {
	ctx := context.Background()

	// Use a temporary JSON file for test isolation
	tmpDir := t.TempDir()
	configFile := filepath.Join(tmpDir, "test_app_config.json")

	cfg := &config.Config{
		AppConfigFile: configFile,
	}
	st := &Store{Cfg: cfg}
	st.InvalidateAppConfigCache()

	// 1. Initial get: should create default file and load into memory
	appConf, err := st.GetAppConfig(ctx)
	if err != nil {
		t.Fatalf("GetAppConfig failed: %v", err)
	}
	if appConf.Accommodation.Amount != 600 {
		t.Errorf("expected default amount 600, got %d", appConf.Accommodation.Amount)
	}
	if appConf.Links.AppleStore == "" || appConf.Links.PlayStore == "" {
		t.Errorf("expected default store links, got empty: %+v", appConf.Links)
	}

	// Verify file was written to disk
	if _, err := os.Stat(configFile); err != nil {
		t.Fatalf("expected config file to be created on disk: %v", err)
	}

	// 2. Test GetAppLinks, GetAppMaintenance, GetAppVersions, GetAppAccommodation
	links, err := st.GetAppLinks(ctx)
	if err != nil || links.PlayStore == "" {
		t.Fatalf("GetAppLinks failed: %v, %v", err, links)
	}

	maint, err := st.GetAppMaintenance(ctx)
	if err != nil || maint.Android != false {
		t.Fatalf("GetAppMaintenance failed: %v, %v", err, maint)
	}

	vers, err := st.GetAppVersions(ctx)
	if err != nil || vers.Android != "1.0.1" {
		t.Fatalf("GetAppVersions failed: %v, %v", err, vers)
	}

	acc, err := st.GetAppAccommodation(ctx)
	if err != nil || acc.TechnicalAmount != 600 {
		t.Fatalf("GetAppAccommodation failed: %v, %v", err, acc)
	}

	// 3. Test SetAppMaintenance
	err = st.SetAppMaintenance(ctx, &models.AppMaintenance{Android: true, IOS: false, Web: true})
	if err != nil {
		t.Fatalf("SetAppMaintenance failed: %v", err)
	}

	maintUpdated, err := st.GetAppMaintenance(ctx)
	if err != nil || !maintUpdated.Android || !maintUpdated.Web || maintUpdated.IOS {
		t.Fatalf("expected updated maintenance status, got: %+v", maintUpdated)
	}

	// 4. Test SetAppAccommodation
	newAcc := &models.AppAccommodation{
		Amount:              750,
		TechnicalAmount:     800,
		CulturalAmount:      700,
		FoodAmount:          200,
		TechnicalFoodAmount: 200,
		CulturalFoodAmount:  200,
		TechnicalDays: map[string]int{
			"day1": 850,
		},
	}
	err = st.SetAppAccommodation(ctx, newAcc)
	if err != nil {
		t.Fatalf("SetAppAccommodation failed: %v", err)
	}

	accUpdated, err := st.GetAppAccommodation(ctx)
	if err != nil || accUpdated.TechnicalAmount != 800 || accUpdated.TechnicalDays["day1"] != 850 {
		t.Fatalf("expected updated accommodation, got: %+v", accUpdated)
	}

	// 5. Test reloading across Store instances (simulating process restart)
	stNew := &Store{Cfg: cfg}
	stNew.InvalidateAppConfigCache()

	reloadedAcc, err := stNew.GetAppAccommodation(ctx)
	if err != nil || reloadedAcc.TechnicalAmount != 800 || reloadedAcc.TechnicalDays["day1"] != 850 {
		t.Fatalf("expected persisted accommodation after restart, got: %+v", reloadedAcc)
	}

	reloadedMaint, err := stNew.GetAppMaintenance(ctx)
	if err != nil || !reloadedMaint.Android || !reloadedMaint.Web {
		t.Fatalf("expected persisted maintenance after restart, got: %+v", reloadedMaint)
	}

	// 6. Test external manual edits on disk being picked up automatically
	time.Sleep(10 * time.Millisecond) // ensure new mtime
	rawJSON := []byte(`{
  "links": { "appleStore": "https://apple.com/custom", "playStore": "https://play.com/custom" },
  "maintenance": { "android": false, "ios": true, "web": false },
  "versions": { "android": "2.0.0", "ios": "2.0.0" },
  "accommodation": { "amount": 900, "foodAmount": 250 }
}`)
	if err := os.WriteFile(configFile, rawJSON, 0644); err != nil {
		t.Fatalf("failed to write external file: %v", err)
	}

	externalVers, err := st.GetAppVersions(ctx)
	if err != nil || externalVers.Android != "2.0.0" {
		t.Fatalf("expected auto-detected external change to 2.0.0, got: %+v", externalVers)
	}
}
