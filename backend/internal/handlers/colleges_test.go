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
		Cfg: &config.Config{
			CollegesFile: "colleges.json",
		},
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

	cacheControl := rec.Header().Get("Cache-Control")
	if cacheControl == "" {
		t.Errorf("expected Cache-Control header on full list")
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
		t.Fatalf("expected matches for query 'Patel'")
	}

	// Non-existent search
	reqNone, _ := http.NewRequest(http.MethodGet, "/api/v1/colleges?q=totallyfakename123456789", nil)
	recNone := httptest.NewRecorder()
	r.ServeHTTP(recNone, reqNone)

	if recNone.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recNone.Code)
	}

	var resNone struct {
		Colleges []string `json:"colleges"`
		Total    int      `json:"total"`
	}
	json.NewDecoder(recNone.Body).Decode(&resNone)
	if resNone.Total != 0 || len(resNone.Colleges) != 0 {
		t.Errorf("expected 0 matches for non-existent college, got %d", resNone.Total)
	}
}
