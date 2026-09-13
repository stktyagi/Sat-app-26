package store

import (
	"context"
	"sort"

	"google.golang.org/api/iterator"

	"backend/internal/models"
)

// VenueExists validates the venueId an admin supplies against the venues
// collection, which is keyed by the same slug the events reference.
func (s *Store) VenueExists(ctx context.Context, id string) (bool, error) {
	if id == "" {
		return true, nil
	}
	_, err := s.FS.Collection(ColVenues).Doc(id).Get(ctx)
	switch {
	case err == nil:
		return true, nil
	case wrap(err) == ErrNotFound:
		return false, nil
	default:
		return false, wrap(err)
	}
}

// AllVenues loads the whole collection sorted by name.
func (s *Store) AllVenues(ctx context.Context) ([]*models.Venue, error) {
	iter := s.FS.Collection(ColVenues).Documents(ctx)
	defer iter.Stop()

	out := []*models.Venue{}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, wrap(err)
		}
		v, err := decodeVenue(doc)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}

	sort.SliceStable(out, func(i, j int) bool { return out[i].VenueName < out[j].VenueName })
	return out, nil
}

func (s *Store) GetVenue(ctx context.Context, id string) (*models.Venue, error) {
	doc, err := s.FS.Collection(ColVenues).Doc(id).Get(ctx)
	if err != nil {
		return nil, wrap(err)
	}
	return decodeVenue(doc)
}

// CreateVenue refuses to overwrite an existing slug.
func (s *Store) CreateVenue(ctx context.Context, v *models.Venue) error {
	_, err := s.FS.Collection(ColVenues).Doc(v.VenueID).Create(ctx, v)
	return wrap(err)
}

func (s *Store) SaveVenue(ctx context.Context, v *models.Venue) error {
	_, err := s.FS.Collection(ColVenues).Doc(v.VenueID).Set(ctx, v)
	return wrap(err)
}

func (s *Store) DeleteVenue(ctx context.Context, id string) error {
	_, err := s.FS.Collection(ColVenues).Doc(id).Delete(ctx)
	return wrap(err)
}

// VenueInUse counts the events that still reference a venue, so deleting it
// cannot leave them pointing at nothing.
func (s *Store) VenueInUse(ctx context.Context, id string) (int, error) {
	q := s.FS.Collection(ColEvents).Where("venueId", "==", id)
	res, err := q.NewAggregationQuery().WithCount("n").Get(ctx)
	if err != nil {
		return 0, wrap(err)
	}
	v, ok := res["n"]
	if !ok {
		return 0, nil
	}
	return int(decodeAggValue(v)), nil
}
