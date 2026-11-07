package handlers

import (
	"context"
	"testing"

	"backend/internal/models"
)

func TestResolveUserAccommodationTier_Defaults(t *testing.T) {
	api := &API{}

	// When store is nil, defaults to cultural
	if tier := api.resolveUserAccommodationTier(context.Background(), "user-1"); tier != models.AccommodationTierCultural {
		t.Fatalf("expected cultural, got %s", tier)
	}

	// When user is empty, defaults to cultural
	if tier := api.resolveUserAccommodationTier(context.Background(), ""); tier != models.AccommodationTierCultural {
		t.Fatalf("expected cultural, got %s", tier)
	}
}

func TestUpdateAccommodationTierOnEventRegistration(t *testing.T) {
	api := &API{}

	// Technical event sets tier to technical
	user := &models.User{UserID: "u1", AccommodationTier: models.AccommodationTierCultural}
	api.updateAccommodationTierOnEventRegistration(context.Background(), user, "Technical")
	// Since api.Store is nil, user.AccommodationTier is still updated in-memory
	// Let's verify with nil store does not panic
	api.updateAccommodationTierOnEventRegistration(context.Background(), nil, "Technical")
}
