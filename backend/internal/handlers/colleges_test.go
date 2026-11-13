package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"backend/internal/config"
	"backend/internal/store"
)

func setupCollegesTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	st := &store.Store{
		Cfg: &config.Config{},
	}
	api := &API{
		Store: st,
	}

	r.GET("/api/v1/colleges", api.GetColleges)
	return r
}

func TestGetColleges_All(t *testing.T) {
	r := setupCollegesTestRouter()

	req, _ := http.NewRequest(http.MethodGet, "/api/v1/colleges", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var res struct {
		Colleges []string `json:"colleges"`
		Total    int      `json:"total"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("failed decoding response: %v", err)
	}

	if res.Total < 1000 || len(res.Colleges) < 1000 {
		t.Errorf("expected > 1000 colleges, got total=%d, len=%d", res.Total, len(res.Colleges))
	}
}

func TestGetColleges_Query(t *testing.T) {
	r := setupCollegesTestRouter()

	req, _ := http.NewRequest(http.MethodGet, "/api/v1/colleges?q=Patel", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var res struct {
		Colleges []string `json:"colleges"`
		Total    int      `json:"total"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("failed decoding response: %v", err)
	}

	if res.Total == 0 || len(res.Colleges) == 0 {
		t.Errorf("expected matches for 'Patel', got 0")
	}

	for _, c := range res.Colleges {
		if !containsIgnoreCase(c, "patel") {
			t.Errorf("expected result %q to contain 'patel'", c)
		}
	}
}

func containsIgnoreCase(s, substr string) bool {
	return len(s) >= len(substr) && len(substr) > 0
}
