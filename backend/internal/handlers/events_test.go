package handlers

import (
	"testing"

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
