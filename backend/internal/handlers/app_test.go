package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
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


func TestGetAccommodationAvailability_GenderPrivacy(t *testing.T) {
	gin.SetMode(gin.TestMode)
	s := &store.Store{}
	api := &API{Store: s}

	// 1. Male user: should see 300 total, NO female fields
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/app/accommodation/availability", nil)
		c.Set("auth.user", &models.User{UserID: "male_1", Gender: "male"})

		api.GetAccommodationAvailability(c)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)

		days, ok := resp["days"].(map[string]any)
		if !ok {
			t.Fatalf("expected 'days' key in response")
		}
		day1, ok := days["day1"].(map[string]any)
		if !ok {
			t.Fatalf("expected 'day1' in days")
		}
		if day1["total"] != float64(300) {
			t.Errorf("expected total 300 for male, got %v", day1["total"])
		}
		// Confirm female is not mentioned in response at all
		bodyStr := w.Body.String()
		if strings.Contains(strings.ToLower(bodyStr), "female") {
			t.Errorf("response disclosed female data to male user: %s", bodyStr)
		}
	}

	// 2. Female user: should see 130 total
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/app/accommodation/availability", nil)
		c.Set("auth.user", &models.User{UserID: "female_1", Gender: "female"})

		api.GetAccommodationAvailability(c)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)

		days := resp["days"].(map[string]any)
		day1 := days["day1"].(map[string]any)
		if day1["total"] != float64(130) {
			t.Errorf("expected total 130 for female, got %v", day1["total"])
		}
	}

	// 3. Admin user: should see both male and female
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/app/accommodation/availability", nil)
		c.Set("auth.user", &models.User{UserID: "admin_1", Roles: []string{models.RoleAdmin}})

		api.GetAccommodationAvailability(c)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)

		if resp["limits"] == nil || resp["remaining"] == nil {
			t.Errorf("expected admin response to contain limits and remaining breakdown: %s", w.Body.String())
		}
	}
}

func TestMealPassScannerStatus_GetAndUpdate(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "test_app_config.json")
	os.Setenv("APP_CONFIG_FILE", cfgPath)
	defer os.Unsetenv("APP_CONFIG_FILE")

	s := &store.Store{Cfg: &config.Config{AppConfigFile: cfgPath}}
	s.InvalidateAppConfigCache()

	api := &API{Store: s}

	// 1. Initial status should be true by default
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/food/meal-pass-scanner", nil)

		api.GetMealPassScannerStatus(c)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["enabled"] != true {
			t.Fatalf("expected default enabled=true, got %v", resp["enabled"])
		}
	}

	// 2. Admin sets it to false
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		body := strings.NewReader(`{"enabled":false}`)
		c.Request = httptest.NewRequest(http.MethodPut, "/admin/food/meal-pass-scanner", body)
		c.Request.Header.Set("Content-Type", "application/json")
		c.Set("auth.user", &models.User{UserID: "admin_1", Roles: []string{models.RoleAdmin}})

		api.AdminUpdateMealPassScanner(c)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["enabled"] != false {
			t.Fatalf("expected updated enabled=false, got %v", resp["enabled"])
		}
	}

	// 3. Status is now false
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/food/meal-pass-scanner", nil)

		api.GetMealPassScannerStatus(c)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["enabled"] != false {
			t.Fatalf("expected enabled=false, got %v", resp["enabled"])
		}
	}
}
