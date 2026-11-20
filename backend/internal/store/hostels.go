package store

import (
	"context"
	"errors"
	"sort"
	"strings"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"backend/internal/isotime"
	"backend/internal/models"
)

const ColHostels = "hostels"

var (
	ErrHostelFull        = errors.New("hostel is full")
	ErrHostelGender      = errors.New("hostel does not accept this gender")
	ErrHostelInactive    = errors.New("hostel is not active")
	ErrNotAllotted       = errors.New("no hostel allotted")
	ErrCapacityBelowUsed = errors.New("capacity below current occupancy")
)

// Hostel actions applied by ApplyHostelAction.
const (
	HostelActionCheckIn      = "checkin"
	HostelActionCheckOut     = "checkout"
	HostelActionUndoCheckOut = "undo_checkout"
	HostelActionRevert       = "revert"
	HostelActionItems        = "items"
)

func decodeHostel(snap *firestore.DocumentSnapshot) (*models.Hostel, error) {
	var h models.Hostel
	if err := snap.DataTo(&h); err != nil {
		return nil, err
	}
	h.ID = snap.Ref.ID
	return &h, nil
}

// ListHostels returns every hostel sorted by name.
func (s *Store) ListHostels(ctx context.Context) ([]*models.Hostel, error) {
	iter := s.FS.Collection(ColHostels).Documents(ctx)
	defer iter.Stop()
	out := []*models.Hostel{}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, wrap(err)
		}
		h, err := decodeHostel(doc)
		if err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name) })
	return out, nil
}

func (s *Store) GetHostel(ctx context.Context, id string) (*models.Hostel, error) {
	doc, err := s.FS.Collection(ColHostels).Doc(id).Get(ctx)
	if err != nil {
		return nil, wrap(err)
	}
	return decodeHostel(doc)
}

// CreateHostel writes a new hostel; the id must not already exist.
func (s *Store) CreateHostel(ctx context.Context, h *models.Hostel) error {
	now := isotime.Now()
	h.CreatedAt, h.UpdatedAt = now, now
	h.Occupied = 0
	_, err := s.FS.Collection(ColHostels).Doc(h.ID).Create(ctx, h)
	return wrap(err)
}

// HostelPatch carries the editable hostel fields; nil means unchanged.
type HostelPatch struct {
	Name     *string
	Gender   *string
	Capacity *int
	Active   *bool
}

// UpdateHostel applies a patch. Capacity may not drop below occupancy.
func (s *Store) UpdateHostel(ctx context.Context, id string, p HostelPatch) (*models.Hostel, error) {
	ref := s.FS.Collection(ColHostels).Doc(id)
	var out *models.Hostel
	err := s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(ref)
		if err != nil {
			return wrap(err)
		}
		h, err := decodeHostel(snap)
		if err != nil {
			return err
		}
		ups := []firestore.Update{{Path: "updatedAt", Value: isotime.Now()}}
		if p.Name != nil {
			h.Name = *p.Name
			ups = append(ups, firestore.Update{Path: "name", Value: h.Name})
		}
		if p.Gender != nil {
			h.Gender = *p.Gender
			ups = append(ups, firestore.Update{Path: "gender", Value: h.Gender})
		}
		if p.Capacity != nil {
			if *p.Capacity < h.Occupied {
				return ErrCapacityBelowUsed
			}
			h.Capacity = *p.Capacity
			ups = append(ups, firestore.Update{Path: "capacity", Value: h.Capacity})
		}
		if p.Active != nil {
			h.Active = *p.Active
			ups = append(ups, firestore.Update{Path: "active", Value: h.Active})
		}
		out = h
		return tx.Update(ref, ups)
	})
	return out, err
}

// hostelTx loads a hostel inside a transaction; a missing doc (legacy static
// hostel code) returns nil without error so counters are simply skipped.
func hostelTx(tx *firestore.Transaction, ref *firestore.DocumentRef) (*models.Hostel, error) {
	snap, err := tx.Get(ref)
	if err != nil {
		if errors.Is(wrap(err), ErrNotFound) {
			return nil, nil
		}
		return nil, wrap(err)
	}
	return decodeHostel(snap)
}

// holdsBed reports whether the user's allotment currently counts toward occupancy.
func holdsBed(st models.CheckInStatus) bool {
	return st.Hostel != "" && !st.CheckedOut
}

// AllotHostel assigns a hostel (and optional room) at the registration desk,
// moving the occupancy counter from any previously held hostel.
func (s *Store) AllotHostel(ctx context.Context, uid, hostelID, roomNo, by string) (*models.User, error) {
	userRef := s.FS.Collection(ColUsers).Doc(uid)
	targetRef := s.FS.Collection(ColHostels).Doc(hostelID)

	err := s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		usnap, err := tx.Get(userRef)
		if err != nil {
			return wrap(err)
		}
		u, err := decodeUser(usnap)
		if err != nil {
			return err
		}
		target, err := hostelTx(tx, targetRef)
		if err != nil {
			return err
		}
		if target == nil {
			return ErrNotFound
		}
		st := u.CheckInStatus
		same := st.Hostel == hostelID && holdsBed(st)

		var prev *models.Hostel
		var prevRef *firestore.DocumentRef
		if !same && holdsBed(st) {
			prevRef = s.FS.Collection(ColHostels).Doc(st.Hostel)
			if prev, err = hostelTx(tx, prevRef); err != nil {
				return err
			}
		}

		if !same {
			if !target.Active {
				return ErrHostelInactive
			}
			if !target.AcceptsGender(u.Gender) {
				return ErrHostelGender
			}
			if target.Occupied >= target.Capacity {
				return ErrHostelFull
			}
		}

		now := isotime.Now()
		if !same {
			if prev != nil {
				if err := tx.Update(prevRef, []firestore.Update{{Path: "occupied", Value: firestore.Increment(-1)}, {Path: "updatedAt", Value: now}}); err != nil {
					return err
				}
			}
			if err := tx.Update(targetRef, []firestore.Update{{Path: "occupied", Value: firestore.Increment(1)}, {Path: "updatedAt", Value: now}}); err != nil {
				return err
			}
		}
		ups := []firestore.Update{
			{Path: "checkInStatus.Hostel", Value: hostelID},
			{Path: "checkInStatus.RoomNo", Value: roomNo},
			{Path: "checkInStatus.allottedAt", Value: now},
			{Path: "checkInStatus.allottedBy", Value: by},
			{Path: "updatedAt", Value: now},
		}
		if st.CheckedOut {
			// A fresh allotment after checkout starts a new stay.
			ups = append(ups,
				firestore.Update{Path: "checkInStatus.checkedOut", Value: false},
				firestore.Update{Path: "checkInStatus.checkedOutAt", Value: ""},
				firestore.Update{Path: "checkInStatus.accommodation", Value: false},
			)
		}
		return tx.Update(userRef, ups)
	})
	evictUserFromCache(uid)
	if err != nil {
		return nil, err
	}
	s.InvalidateAccommodationCache()
	return s.GetUser(ctx, uid)
}

// HostelActionInput is what the hostel check-in desk sends.
type HostelActionInput struct {
	Action string
	RoomNo *string
	Items  *models.HostelItems
}

// ApplyHostelAction runs a hostel check-in state change and keeps the hostel
// occupancy counter in step within one transaction.
func (s *Store) ApplyHostelAction(ctx context.Context, uid string, in HostelActionInput) (*models.User, error) {
	userRef := s.FS.Collection(ColUsers).Doc(uid)

	err := s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		usnap, err := tx.Get(userRef)
		if err != nil {
			return wrap(err)
		}
		u, err := decodeUser(usnap)
		if err != nil {
			return err
		}
		st := u.CheckInStatus
		var h *models.Hostel
		var hRef *firestore.DocumentRef
		if st.Hostel != "" {
			hRef = s.FS.Collection(ColHostels).Doc(st.Hostel)
			if h, err = hostelTx(tx, hRef); err != nil {
				return err
			}
		}

		now := isotime.Now()
		ups := []firestore.Update{{Path: "updatedAt", Value: now}}
		delta := 0

		switch in.Action {
		case HostelActionCheckIn:
			if st.Hostel == "" {
				ups = append(ups,
					firestore.Update{Path: "checkInStatus.accommodation", Value: true},
					firestore.Update{Path: "checkInStatus.fest", Value: true},
					firestore.Update{Path: "checkInStatus.checkedOut", Value: false},
					firestore.Update{Path: "checkInStatus.checkedOutAt", Value: ""},
				)
				if !st.Accommodation || st.CheckedOut || st.CheckedInAt == "" {
					ups = append(ups, firestore.Update{Path: "checkInStatus.checkedInAt", Value: now})
				}
				break
			}
			if st.CheckedOut {
				delta = 1
			}
			ups = append(ups,
				firestore.Update{Path: "checkInStatus.accommodation", Value: true},
				firestore.Update{Path: "checkInStatus.checkedOut", Value: false},
				firestore.Update{Path: "checkInStatus.checkedOutAt", Value: ""},
			)
			if !st.Accommodation || st.CheckedOut || st.CheckedInAt == "" {
				ups = append(ups, firestore.Update{Path: "checkInStatus.checkedInAt", Value: now})
			}
		case HostelActionCheckOut:
			if st.CheckedOut {
				break
			}
			if st.Hostel != "" {
				delta = -1
			}
			ups = append(ups,
				firestore.Update{Path: "checkInStatus.accommodation", Value: true},
				firestore.Update{Path: "checkInStatus.checkedOut", Value: true},
				firestore.Update{Path: "checkInStatus.checkedOutAt", Value: now},
			)
		case HostelActionUndoCheckOut:
			if !st.CheckedOut {
				break
			}
			if st.Hostel != "" {
				delta = 1
			}
			ups = append(ups,
				firestore.Update{Path: "checkInStatus.accommodation", Value: true},
				firestore.Update{Path: "checkInStatus.checkedOut", Value: false},
				firestore.Update{Path: "checkInStatus.checkedOutAt", Value: ""},
			)
		case HostelActionRevert:
			if holdsBed(st) {
				delta = -1
			}
			ups = append(ups,
				firestore.Update{Path: "checkInStatus.accommodation", Value: false},
				firestore.Update{Path: "checkInStatus.checkedOut", Value: false},
				firestore.Update{Path: "checkInStatus.checkedOutAt", Value: ""},
				firestore.Update{Path: "checkInStatus.checkedInAt", Value: ""},
				firestore.Update{Path: "checkInStatus.Hostel", Value: ""},
				firestore.Update{Path: "checkInStatus.RoomNo", Value: ""},
				firestore.Update{Path: "checkInStatus.allottedAt", Value: ""},
				firestore.Update{Path: "checkInStatus.allottedBy", Value: ""},
				firestore.Update{Path: "checkInStatus.items", Value: models.HostelItems{}},
			)
		case HostelActionItems:
		default:
			return errors.New("unknown hostel action")
		}

		if in.Action != HostelActionRevert {
			if in.RoomNo != nil {
				ups = append(ups, firestore.Update{Path: "checkInStatus.RoomNo", Value: strings.TrimSpace(*in.RoomNo)})
			}
			if in.Items != nil {
				ups = append(ups, firestore.Update{Path: "checkInStatus.items", Value: *in.Items})
			}
		}

		if delta > 0 && h != nil && h.Occupied >= h.Capacity {
			return ErrHostelFull
		}
		if delta != 0 && h != nil {
			if err := tx.Update(hRef, []firestore.Update{{Path: "occupied", Value: firestore.Increment(delta)}, {Path: "updatedAt", Value: now}}); err != nil {
				return err
			}
		}
		return tx.Update(userRef, ups)
	})
	evictUserFromCache(uid)
	if err != nil {
		return nil, err
	}
	s.InvalidateAccommodationCache()
	return s.GetUser(ctx, uid)
}

// SetGateStatus updates only the gate fields of checkInStatus.
func (s *Store) SetGateStatus(ctx context.Context, uid string, fest bool, remark string) (*models.User, error) {
	gateAt := ""
	if fest {
		gateAt = isotime.Now()
	}
	ups := []firestore.Update{
		{Path: "checkInStatus.fest", Value: fest},
		{Path: "checkInStatus.remark", Value: remark},
		{Path: "checkInStatus.gateAt", Value: gateAt},
		{Path: "updatedAt", Value: isotime.Now()},
	}
	_, err := s.FS.Collection(ColUsers).Doc(uid).Update(ctx, ups)
	evictUserFromCache(uid)
	if err != nil {
		return nil, wrap(err)
	}
	s.InvalidateAccommodationCache()
	return s.GetUser(ctx, uid)
}
