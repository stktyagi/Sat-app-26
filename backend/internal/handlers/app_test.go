package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"

	"backend/internal/config"
	"backend/internal/models"
	"backend/internal/store"
)

func TestGetAdminNavigation_FilteringByRole(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "test_app_config.json")
	os.Setenv("APP_CONFIG_FILE", cfgPath)
	defer os.Unsetenv("APP_CONFIG_FILE")

	s := &store.Store{Cfg: &config.Config{AppConfigFile: cfgPath}}
	s.InvalidateAppConfigCache()

	api := &API{Store: s}

	// 1. Test user with eb_hospitality role
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/navigation", nil)

		user := &models.User{
			UserID: "hosp_user",
			Roles:  []string{models.RoleEBHospitality},
		}
		c.Set("auth.user", user)

		api.GetAdminNavigation(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Items []models.AdminScreenConfig `json:"items"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		keys := make(map[string]bool)
		for _, item := range resp.Items {
			keys[item.Key] = true
		}

		// eb_hospitality should have accommodation, qr_scanner, meal_pass_qr, users_management
		if !keys["accommodation"] {
			t.Errorf("expected accommodation screen for eb_hospitality")
		}
		if !keys["qr_scanner"] {
			t.Errorf("expected qr_scanner screen for eb_hospitality")
		}
		if !keys["meal_pass_qr"] {
			t.Errorf("expected meal_pass_qr screen for eb_hospitality")
		}
		if !keys["users_management"] {
			t.Errorf("expected users_management screen for eb_hospitality")
		}

		// Should NOT have events_management or payment_management or app_config
		if keys["events_management"] {
			t.Errorf("events_management should NOT be visible to eb_hospitality")
		}
		if keys["payment_management"] {
			t.Errorf("payment_management should NOT be visible to eb_hospitality")
		}
		if keys["app_config"] {
			t.Errorf("app_config should NOT be visible to eb_hospitality")
		}
	}

	// 2. Test full admin receives all screens
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/navigation", nil)

		user := &models.User{
			UserID: "admin_user",
			Roles:  []string{models.RoleAdmin},
		}
		c.Set("auth.user", user)

		api.GetAdminNavigation(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}

		var resp struct {
			Items []models.AdminScreenConfig `json:"items"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if len(resp.Items) < 10 {
			t.Errorf("expected all admin screens for admin, got %d", len(resp.Items))
		}
	}
}

func TestAdminUpdateAdminScreens_UpdatesOnTheFly(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "test_app_config.json")
	os.Setenv("APP_CONFIG_FILE", cfgPath)
	defer os.Unsetenv("APP_CONFIG_FILE")

	s := &store.Store{Cfg: &config.Config{AppConfigFile: cfgPath}}
	s.InvalidateAppConfigCache()

	api := &API{Store: s}

	// Now grant eb_hospitality access to "payment_management" on the fly
	updatedScreens := []models.AdminScreenConfig{
		{
			Key:           "accommodation",
			Label:         "Accommodation",
			Icon:          "bed-outline",
			Route:         "/admin/Accommodation",
			RequiredRoles: []string{models.RoleAdmin, models.RoleEBHospitality},
		},
		{
			Key:           "payment_management",
			Label:         "Payment Management",
			Icon:          "card-outline",
			Route:         "/admin/Transactions",
			RequiredRoles: []string{models.RoleAdmin, models.RoleEBHospitality}, // eb_hospitality added!
		},
	}

	if err := s.SetAdminScreens(context.Background(), updatedScreens); err != nil {
		t.Fatalf("SetAdminScreens error: %v", err)
	}

	// Verify that eb_hospitality now gets payment_management
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/admin/navigation", nil)

	user := &models.User{
		UserID: "hosp_user",
		Roles:  []string{models.RoleEBHospitality},
	}
	c.Set("auth.user", user)

	api.GetAdminNavigation(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp struct {
		Items []models.AdminScreenConfig `json:"items"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if len(resp.Items) != 2 {
		t.Fatalf("expected 2 screens, got %d", len(resp.Items))
	}
	if resp.Items[1].Key != "payment_management" {
		t.Errorf("expected payment_management on the fly, got %s", resp.Items[1].Key)
	}
}
