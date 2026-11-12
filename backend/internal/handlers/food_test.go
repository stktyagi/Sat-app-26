package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/config"
	"backend/internal/models"
	"backend/internal/qr"
)

func TestFestDay(t *testing.T) {
	day0 := time.Date(2026, 11, 20, 0, 0, 0, 0, config.IST)
	cases := []struct {
		now  time.Time
		want string
		ok   bool
	}{
		{time.Date(2026, 11, 20, 8, 0, 0, 0, config.IST), "day0", true},
		{time.Date(2026, 11, 20, 23, 30, 0, 0, config.IST), "day0", true},
		{time.Date(2026, 11, 20, 18, 45, 0, 0, time.UTC), "day1", true}, // 00:15 IST next day
		{time.Date(2026, 11, 24, 12, 0, 0, 0, config.IST), "day4", true},
		{time.Date(2026, 11, 19, 23, 59, 0, 0, config.IST), "", false},
		{time.Date(2026, 11, 25, 0, 0, 0, 0, config.IST), "", false},
	}
	for _, tc := range cases {
		got, ok := festDay(day0, tc.now)
		if got != tc.want || ok != tc.ok {
			t.Errorf("festDay(%v) = %q,%v want %q,%v", tc.now, got, ok, tc.want, tc.ok)
		}
	}
}

func setupFoodTestAPI(day0 time.Time) *API {
	signer := qr.New([]byte("test_secret_for_qr_signing_12345678"))
	return &API{
		QR: signer,
		Cfg: &config.Config{
			FestDay0: day0,
		},
	}
}

func TestAdminGenerateFoodQR_CommonDay(t *testing.T) {
	gin.SetMode(gin.TestMode)
	api := setupFoodTestAPI(time.Date(2026, 11, 20, 0, 0, 0, 0, config.IST))

	// Request specific day
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := bytes.NewBufferString(`{"day":"day2"}`)
	c.Request, _ = http.NewRequest("POST", "/admin/food/generate", body)
	c.Request.Header.Set("Content-Type", "application/json")

	api.AdminGenerateFoodQR(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Day string `json:"day"`
		QR  string `json:"qr"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if resp.Day != "day2" {
		t.Errorf("expected day2, got %q", resp.Day)
	}

	// Verify signed QR has common food prefix
	payload, err := api.QR.Verify(resp.QR)
	if err != nil {
		t.Fatalf("QR verification failed: %v", err)
	}
	if payload != "food:day2" {
		t.Errorf("expected payload food:day2, got %q", payload)
	}
}

func TestAdminGenerateFoodQR_AllDays(t *testing.T) {
	gin.SetMode(gin.TestMode)
	api := setupFoodTestAPI(time.Date(2026, 11, 20, 0, 0, 0, 0, config.IST))

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := bytes.NewBufferString(`{"day":"all"}`)
	c.Request, _ = http.NewRequest("POST", "/admin/food/generate", body)
	c.Request.Header.Set("Content-Type", "application/json")

	api.AdminGenerateFoodQR(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Day string `json:"day"`
		QR  string `json:"qr"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if resp.Day != "all" {
		t.Errorf("expected day 'all', got %q", resp.Day)
	}

	payload, err := api.QR.Verify(resp.QR)
	if err != nil {
		t.Fatalf("QR verification failed: %v", err)
	}
	if payload != "food:all" {
		t.Errorf("expected payload food:all, got %q", payload)
	}
}

func TestScanFoodQR_AllowedWithCheckInNotice(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Now().In(config.IST)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, config.IST)
	// Set FestDay0 to today so currentDay is day0
	api := setupFoodTestAPI(todayStart)

	qrToken := api.QR.Sign("food:day0")

	// User has food for day0, but has NOT checked in to accommodation
	testUser := &models.User{
		UserID:      "user123",
		DisplayName: "Test Student",
		Food:        map[string]bool{"day0": true},
		CheckInStatus: models.CheckInStatus{
			Accommodation: false,
		},
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("auth.user", testUser)

	reqBody, _ := json.Marshal(map[string]string{"data": qrToken})
	c.Request, _ = http.NewRequest("POST", "/food/scan", bytes.NewBuffer(reqBody))
	c.Request.Header.Set("Content-Type", "application/json")

	api.ScanFoodQR(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Allowed                   bool   `json:"allowed"`
		Reason                    string `json:"reason"`
		Day                       string `json:"day"`
		NeedsAccommodationCheckIn bool   `json:"needsAccommodationCheckIn"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if !resp.Allowed {
		t.Errorf("expected allowed=true, got false (reason=%s)", resp.Reason)
	}
	if !resp.NeedsAccommodationCheckIn {
		t.Errorf("expected needsAccommodationCheckIn=true since user is not checked in to accommodation")
	}
	if resp.Day != "day0" {
		t.Errorf("expected day0, got %s", resp.Day)
	}
}

func TestScanFoodQR_AllDays_Allowed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Now().In(config.IST)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, config.IST)
	api := setupFoodTestAPI(todayStart) // Today is day0

	qrToken := api.QR.Sign("food:all") // Universal 5-day QR

	// User has food for today (day0)
	testUser := &models.User{
		UserID:      "user_allday",
		DisplayName: "Fest Student",
		Food:        map[string]bool{"day0": true, "day1": true, "day2": true},
		CheckInStatus: models.CheckInStatus{
			Accommodation: true,
		},
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("auth.user", testUser)

	reqBody, _ := json.Marshal(map[string]string{"data": qrToken})
	c.Request, _ = http.NewRequest("POST", "/food/scan", bytes.NewBuffer(reqBody))
	c.Request.Header.Set("Content-Type", "application/json")

	api.ScanFoodQR(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Allowed bool   `json:"allowed"`
		Reason  string `json:"reason"`
		Day     string `json:"day"`
		QrDay   string `json:"qrDay"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if !resp.Allowed {
		t.Errorf("expected allowed=true for all-day QR on valid day, got false: %s", resp.Reason)
	}
	if resp.QrDay != "all" {
		t.Errorf("expected qrDay='all', got %q", resp.QrDay)
	}
	if resp.Day != "day0" {
		t.Errorf("expected day='day0', got %q", resp.Day)
	}
}

func TestScanFoodQR_AllDays_NoFoodToday(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Now().In(config.IST)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, config.IST)
	api := setupFoodTestAPI(todayStart) // Today is day0

	qrToken := api.QR.Sign("food:all") // Universal 5-day QR

	// User only has food for day1, NOT today (day0)
	testUser := &models.User{
		UserID:      "user_nofood",
		DisplayName: "Tomorrow Student",
		Food:        map[string]bool{"day0": false, "day1": true},
		CheckInStatus: models.CheckInStatus{
			Accommodation: true,
		},
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("auth.user", testUser)

	reqBody, _ := json.Marshal(map[string]string{"data": qrToken})
	c.Request, _ = http.NewRequest("POST", "/food/scan", bytes.NewBuffer(reqBody))
	c.Request.Header.Set("Content-Type", "application/json")

	api.ScanFoodQR(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Allowed bool   `json:"allowed"`
		Reason  string `json:"reason"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.Allowed {
		t.Errorf("expected allowed=false when user has no food for today")
	}
	if resp.Reason != "no_food_today" {
		t.Errorf("expected reason 'no_food_today', got %q", resp.Reason)
	}
}

func TestScanFoodQR_DeniedNoFood(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Now().In(config.IST)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, config.IST)
	api := setupFoodTestAPI(todayStart)

	qrToken := api.QR.Sign("food:day0")

	// User does not have food for day0
	testUser := &models.User{
		UserID:      "user456",
		DisplayName: "Unpaid Student",
		Food:        map[string]bool{"day0": false, "day1": true},
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("auth.user", testUser)

	reqBody, _ := json.Marshal(map[string]string{"data": qrToken})
	c.Request, _ = http.NewRequest("POST", "/food/scan", bytes.NewBuffer(reqBody))
	c.Request.Header.Set("Content-Type", "application/json")

	api.ScanFoodQR(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Allowed bool   `json:"allowed"`
		Reason  string `json:"reason"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.Allowed {
		t.Errorf("expected allowed=false for user without food today")
	}
	if resp.Reason != "no_food_today" {
		t.Errorf("expected reason 'no_food_today', got %q", resp.Reason)
	}
}

func TestScanFoodQR_DeniedWrongDay(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Now().In(config.IST)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, config.IST)
	api := setupFoodTestAPI(todayStart) // Today is day0

	qrToken := api.QR.Sign("food:day1") // Scanning day1 QR on day0

	testUser := &models.User{
		UserID:      "user789",
		DisplayName: "Wrong Day Student",
		Food:        map[string]bool{"day0": true, "day1": true},
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("auth.user", testUser)

	reqBody, _ := json.Marshal(map[string]string{"data": qrToken})
	c.Request, _ = http.NewRequest("POST", "/food/scan", bytes.NewBuffer(reqBody))
	c.Request.Header.Set("Content-Type", "application/json")

	api.ScanFoodQR(c)

	var resp struct {
		Allowed bool   `json:"allowed"`
		Reason  string `json:"reason"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.Allowed {
		t.Errorf("expected allowed=false for wrong day QR")
	}
	if resp.Reason != "wrong_day" {
		t.Errorf("expected reason 'wrong_day', got %q", resp.Reason)
	}
}
