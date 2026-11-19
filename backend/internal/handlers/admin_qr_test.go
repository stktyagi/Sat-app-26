package handlers

import (
	"testing"

	"backend/internal/models"
	"backend/internal/store"
)

func TestNormalizeCheckinStatus(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"checked-in", models.CheckinDone},
		{"checked in", models.CheckinDone},
		{"CHECKED IN", models.CheckinDone},
		{"checked_in", models.CheckinDone},
		{"rejected", models.CheckinRejected},
		{"REJECTED", models.CheckinRejected},
		{"pending", models.CheckinPending},
		{"", models.CheckinPending},
	}

	for _, tc := range tests {
		got := models.NormalizeCheckinStatus(tc.input)
		if got != tc.expected {
			t.Errorf("NormalizeCheckinStatus(%q) = %q; want %q", tc.input, got, tc.expected)
		}
	}
}

func TestHospitalityRoles(t *testing.T) {
	core := &models.User{Roles: []string{"user", "hospitality_core"}}
	ec := &models.User{Roles: []string{"user", models.RoleECHospitality}}
	eb := &models.User{Roles: []string{"user", models.RoleEBHospitality}}
	plain := &models.User{Roles: []string{"user"}}

	if !core.HasRole(models.RoleCoreHospitality) {
		t.Error("hospitality_core alias should normalize to core_hospitality")
	}
	for _, u := range []*models.User{core, ec, eb} {
		if !u.IsHospitality() {
			t.Errorf("%v should be hospitality", u.Roles)
		}
	}
	if plain.IsHospitality() {
		t.Error("plain user should not be hospitality")
	}
	if core.IsHospitalityLead() {
		t.Error("core must not be a hospitality lead (no reverts)")
	}
	if !ec.IsHospitalityLead() || !eb.IsHospitalityLead() {
		t.Error("eb and ec should be hospitality leads")
	}
	if ec.IsHospitalityEB() || !eb.IsHospitalityEB() {
		t.Error("only eb should pass IsHospitalityEB")
	}
	var nilUser *models.User
	if nilUser.IsHospitalityLead() {
		t.Error("nil user must not be a lead")
	}
}

func TestResolveHostelAction(t *testing.T) {
	str := func(s string) *string { return &s }
	b := func(v bool) *bool { return &v }
	checkedOut := models.CheckInStatus{CheckedOut: true}
	cases := []struct {
		req  hostelCheckInRequest
		cur  models.CheckInStatus
		want string
	}{
		{hostelCheckInRequest{Action: str("Checkout")}, models.CheckInStatus{}, store.HostelActionCheckOut},
		{hostelCheckInRequest{Accommodation: b(false)}, models.CheckInStatus{}, store.HostelActionRevert},
		{hostelCheckInRequest{CheckedOut: b(true)}, models.CheckInStatus{}, store.HostelActionCheckOut},
		{hostelCheckInRequest{CheckedOut: b(false)}, checkedOut, store.HostelActionUndoCheckOut},
		{hostelCheckInRequest{Accommodation: b(true)}, models.CheckInStatus{}, store.HostelActionCheckIn},
		{hostelCheckInRequest{}, models.CheckInStatus{}, store.HostelActionItems},
	}
	for i, tc := range cases {
		if got := resolveHostelAction(tc.req, tc.cur); got != tc.want {
			t.Errorf("case %d: got %q want %q", i, got, tc.want)
		}
	}
}

func TestHostelItemsUnreturned(t *testing.T) {
	i := models.HostelItems{PillowGiven: true, MattressGiven: true, MattressReturned: true}
	got := i.Unreturned()
	if len(got) != 1 || got[0] != "pillow" {
		t.Errorf("Unreturned = %v, want [pillow]", got)
	}
}
