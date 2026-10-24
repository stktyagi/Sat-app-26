package handlers

import (
	"testing"

	"backend/internal/models"
)

func TestApplyVenueBody(t *testing.T) {
	name := "Main Audi"
	lat := 30.352
	lng := 76.370

	v := &models.Venue{
		VenueID:   "main-audi",
		VenueName: "Old Name",
		Lat:       0,
		Lng:       0,
	}

	b := &venueBody{
		VenueName: &name,
		Lat:       &lat,
		Lng:       &lng,
	}

	n := applyVenueBody(v, b)
	if n != 3 {
		t.Fatalf("expected 3 fields applied, got %d", n)
	}
	if v.VenueName != "Main Audi" || v.Lat != 30.352 || v.Lng != 76.370 {
		t.Errorf("unexpected venue state: %+v", v)
	}
}

func TestApplyVenueBodyWithLatitudeLongitudeAliases(t *testing.T) {
	lat := 30.354
	lng := 76.368

	v := &models.Venue{
		VenueID:   "cos",
		VenueName: "COS",
		Lat:       0,
		Lng:       0,
	}

	b := &venueBody{
		Latitude:  &lat,
		Longitude: &lng,
	}

	n := applyVenueBody(v, b)
	if n != 2 {
		t.Fatalf("expected 2 fields applied, got %d", n)
	}
	if v.Lat != 30.354 || v.Lng != 76.368 {
		t.Errorf("aliases not applied properly: %+v", v)
	}
}

func TestValidateVenue(t *testing.T) {
	cases := []struct {
		name    string
		venue   models.Venue
		wantErr bool
	}{
		{
			name: "valid venue",
			venue: models.Venue{
				VenueID:   "csed",
				VenueName: "CSED",
				Lat:       30.354,
				Lng:       76.369,
			},
			wantErr: false,
		},
		{
			name: "missing name",
			venue: models.Venue{
				VenueID:   "csed",
				VenueName: "",
				Lat:       30.354,
				Lng:       76.369,
			},
			wantErr: true,
		},
		{
			name: "latitude out of range (>90)",
			venue: models.Venue{
				VenueID:   "csed",
				VenueName: "CSED",
				Lat:       91.0,
				Lng:       76.369,
			},
			wantErr: true,
		},
		{
			name: "longitude out of range (>180)",
			venue: models.Venue{
				VenueID:   "csed",
				VenueName: "CSED",
				Lat:       30.354,
				Lng:       181.0,
			},
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateVenue(&tc.venue)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validateVenue() error = %v, wantErr %v", err, tc.wantErr)
			}
		})
	}
}

func TestCoordinatesBody(t *testing.T) {
	lat := 30.35
	lng := 76.36
	cb := &coordinatesBody{
		Latitude:  &lat,
		Longitude: &lng,
	}

	if cb.getLat() == nil || *cb.getLat() != 30.35 {
		t.Errorf("getLat() = %v, want 30.35", cb.getLat())
	}
	if cb.getLng() == nil || *cb.getLng() != 76.36 {
		t.Errorf("getLng() = %v, want 76.36", cb.getLng())
	}
}

func TestBatchVenueItemCoordinates(t *testing.T) {
	lat := 30.351
	lng := 76.361
	item := &batchVenueItem{
		VenueID:   "hostel-c",
		Latitude:  &lat,
		Longitude: &lng,
	}

	if item.getLat() == nil || *item.getLat() != 30.351 {
		t.Errorf("getLat() = %v, want 30.351", item.getLat())
	}
	if item.getLng() == nil || *item.getLng() != 76.361 {
		t.Errorf("getLng() = %v, want 76.361", item.getLng())
	}
}
