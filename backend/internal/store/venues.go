package store

import "context"

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
