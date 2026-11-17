package handlers

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"backend/internal/models"
)

func TestSortEvents(t *testing.T) {
	mk := func(id, start string, featured bool) *models.Event {
		return &models.Event{ID: id, StartDateTime: start, IsFeatured: featured}
	}
	list := []*models.Event{
		mk("c", "2026-01-07T10:00:00.000Z", false),
		mk("a", "2026-01-05T10:00:00.000Z", false),
		mk("b", "2026-01-06T10:00:00.000Z", true),
	}

	sortEvents(list, "")
	if list[0].ID != "a" || list[2].ID != "c" {
		t.Errorf("default sort should be chronological, got %s %s %s", list[0].ID, list[1].ID, list[2].ID)
	}

	sortEvents(list, "-startDateTime")
	if list[0].ID != "c" {
		t.Errorf("descending sort should start at the latest, got %s", list[0].ID)
	}

	sortEvents(list, "featured")
	if list[0].ID != "b" {
		t.Errorf("featured sort should lead with the featured event, got %s", list[0].ID)
	}
	if list[1].ID != "a" {
		t.Errorf("featured sort should stay chronological below the fold, got %s", list[1].ID)
	}
}


func TestIsAllowedWebsiteDomain(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	// No headers (mobile app)
	c.Request = httptest.NewRequest("GET", "/api/v1/events", nil)
	if isAllowedWebsiteDomain(c) {
		t.Errorf("expected false for mobile app request with no Origin/Referer")
	}

	// Origin: saturnalia.in
	c.Request = httptest.NewRequest("GET", "/api/v1/events", nil)
	c.Request.Header.Set("Origin", "https://saturnalia.in")
	if !isAllowedWebsiteDomain(c) {
		t.Errorf("expected true for Origin: https://saturnalia.in")
	}

	// Origin: www.saturnalia.in
	c.Request = httptest.NewRequest("GET", "/api/v1/events", nil)
	c.Request.Header.Set("Origin", "https://www.saturnalia.in")
	if !isAllowedWebsiteDomain(c) {
		t.Errorf("expected true for Origin: https://www.saturnalia.in")
	}

	// Referer: https://saturnalia.in/events
	c.Request = httptest.NewRequest("GET", "/api/v1/events", nil)
	c.Request.Header.Set("Referer", "https://saturnalia.in/events")
	if !isAllowedWebsiteDomain(c) {
		t.Errorf("expected true for Referer: https://saturnalia.in/events")
	}

	// Unrelated origin
	c.Request = httptest.NewRequest("GET", "/api/v1/events", nil)
	c.Request.Header.Set("Origin", "https://otherwebsite.com")
	if isAllowedWebsiteDomain(c) {
		t.Errorf("expected false for Origin: https://otherwebsite.com")
	}
}

func TestIsPreregisteredEvent(t *testing.T) {
	if !isPreregisteredEvent("[Preregistered] Go Kart") {
		t.Errorf("expected true for [Preregistered] Go Kart")
	}
	if !isPreregisteredEvent("[preregistered] Laser Tag") {
		t.Errorf("expected true for [preregistered] Laser Tag")
	}
	if isPreregisteredEvent("Regular Event") {
		t.Errorf("expected false for Regular Event")
	}
}
