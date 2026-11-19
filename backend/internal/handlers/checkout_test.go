package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"backend/internal/models"
	"backend/internal/qr"
)

func TestAdminGenerateCheckoutQR(t *testing.T) {
	gin.SetMode(gin.TestMode)
	signer := qr.New([]byte("test_secret_for_checkout"))
	api := &API{QR: signer}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/admin/checkout/generate", nil)

	api.AdminGenerateCheckoutQR(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		QR   string `json:"qr"`
		Type string `json:"type"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	payload, err := signer.Verify(resp.QR)
	if err != nil {
		t.Fatalf("failed to verify generated QR: %v", err)
	}
	if payload != "checkout:all" {
		t.Fatalf("expected payload 'checkout:all', got %q", payload)
	}
}

func TestUserCheckout_InvalidQR(t *testing.T) {
	gin.SetMode(gin.TestMode)
	signer := qr.New([]byte("test_secret_for_checkout"))
	api := &API{QR: signer}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body, _ := json.Marshal(map[string]string{"data": "invalid-token"})
	c.Request = httptest.NewRequest(http.MethodPost, "/hostel/checkout", bytes.NewBuffer(body))
	c.Set("auth.user", &models.User{UserID: "u1"})

	api.UserCheckout(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid QR, got %d", w.Code)
	}
}

func TestUserCheckout_AlreadyCheckedOut(t *testing.T) {
	gin.SetMode(gin.TestMode)
	signer := qr.New([]byte("test_secret_for_checkout"))
	api := &API{QR: signer}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	validToken := signer.Sign("checkout:all")
	body, _ := json.Marshal(map[string]string{"data": validToken})
	c.Request = httptest.NewRequest(http.MethodPost, "/hostel/checkout", bytes.NewBuffer(body))
	c.Set("auth.user", &models.User{
		UserID: "u1",
		CheckInStatus: models.CheckInStatus{
			Hostel:        "hostel-b",
			RoomNo:        "204",
			Accommodation: true,
			CheckedOut:    true,
		},
	})

	api.UserCheckout(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for already checked out user, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["already"] != true {
		t.Fatalf("expected already=true, got %v", resp["already"])
	}
}
