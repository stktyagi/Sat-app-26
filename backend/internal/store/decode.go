package store

import (
	"cloud.google.com/go/firestore"

	"backend/internal/models"
)

// Decoding goes through firestore.DataTo and the struct tags on the models.
// That is only safe because this API owns every write to these collections: a
// type mismatch is a bug, and DataTo failing loudly is the behaviour we want.
//
// Each decoder stamps the document ID onto the model, because the ID is never
// duplicated inside the document, and calls Normalise so empty arrays serialise
// as [] rather than null.

func decodeUser(snap *firestore.DocumentSnapshot) (*models.User, error) {
	var u models.User
	if err := snap.DataTo(&u); err != nil {
		return nil, err
	}
	u.UserID = snap.Ref.ID
	if u.Interests == nil {
		u.Interests = []string{}
	}
	if len(u.Roles) == 0 {
		u.Roles = []string{models.RoleUser}
	}
	return &u, nil
}

func decodeEvent(snap *firestore.DocumentSnapshot) (*models.Event, error) {
	var e models.Event
	if err := snap.DataTo(&e); err != nil {
		return nil, err
	}
	e.ID = snap.Ref.ID
	if e.EventID == "" {
		e.EventID = snap.Ref.ID
	}
	e.Normalise()
	return &e, nil
}

func decodeRegistration(snap *firestore.DocumentSnapshot) (*models.Registration, error) {
	var r models.Registration
	if err := snap.DataTo(&r); err != nil {
		return nil, err
	}
	r.ID = snap.Ref.ID
	r.Normalise()
	return &r, nil
}

func decodeFaq(snap *firestore.DocumentSnapshot) (*models.Faq, error) {
	var f models.Faq
	if err := snap.DataTo(&f); err != nil {
		return nil, err
	}
	f.ID = snap.Ref.ID
	return &f, nil
}

func decodeVenue(snap *firestore.DocumentSnapshot) (*models.Venue, error) {
	var v models.Venue
	if err := snap.DataTo(&v); err != nil {
		return nil, err
	}
	if v.VenueID == "" {
		v.VenueID = snap.Ref.ID
	}
	return &v, nil
}

func decodeTeam(snap *firestore.DocumentSnapshot) (*models.Team, error) {
	var t models.Team
	if err := snap.DataTo(&t); err != nil {
		return nil, err
	}
	t.TeamID = snap.Ref.ID
	t.Normalise()
	return &t, nil
}
