package models_test

import (
	"testing"

	"backend/internal/models"
)

// Roles are additive permissions, so the check has to be a membership test
// rather than an equality test against a single value.
func TestIsAdminIsAMembershipTest(t *testing.T) {
	cases := []struct {
		name  string
		roles []string
		want  bool
	}{
		{"plain user", []string{models.RoleUser}, false},
		{"admin alongside user", []string{models.RoleUser, models.RoleAdmin}, true},
		{"admin alone", []string{models.RoleAdmin}, true},
		{"no roles at all", nil, false},
		{"an unrelated role", []string{models.RoleUser, "volunteer"}, false},
	}
	for _, tc := range cases {
		u := &models.User{Roles: tc.roles}
		if got := u.IsAdmin(); got != tc.want {
			t.Errorf("%s: IsAdmin() = %v, want %v", tc.name, got, tc.want)
		}
	}

	// An anonymous caller is a nil user on every open route, so this must not
	// panic and must never be an administrator.
	var anonymous *models.User
	if anonymous.IsAdmin() {
		t.Error("a nil user must not be an administrator")
	}
	if anonymous.HasRole(models.RoleUser) {
		t.Error("a nil user holds no roles")
	}
}

func TestNewUserStartsAsAPlainUser(t *testing.T) {
	u := models.NewUser("uid-1", "someone@thapar.edu", "Someone", "AB12CD")

	if !u.HasRole(models.RoleUser) || u.IsAdmin() {
		t.Errorf("a new account should hold only the user role, got %v", u.Roles)
	}
	if u.FullyRegistered {
		t.Error("a new account is not fully registered until the profile is completed")
	}
	if u.Interests == nil {
		t.Error("slice fields should be initialised so they serialise as [] rather than null")
	}
	if u.CreatedAt == "" || u.UpdatedAt == "" {
		t.Error("timestamps should be stamped at creation")
	}
}

// The host flag is derived on every load rather than stored, so it has to be
// resolvable from the email alone.
func TestResolveHostStatus(t *testing.T) {
	host := (&models.User{Email: "student@thapar.edu"}).ResolveHostStatus("thapar.edu")
	if !host.IsHostCollegeStudent {
		t.Error("a host-domain address should resolve as a host student")
	}

	external := (&models.User{Email: "someone@gmail.com"}).ResolveHostStatus("thapar.edu")
	if external.IsHostCollegeStudent {
		t.Error("an outside address should resolve as external")
	}

	// Re-resolving against a different domain must overwrite, never accumulate.
	if host.ResolveHostStatus("example.com").IsHostCollegeStudent {
		t.Error("resolving against another domain should clear the flag")
	}

	var anonymous *models.User
	if anonymous.ResolveHostStatus("thapar.edu") != nil {
		t.Error("resolving a nil user should stay nil rather than panic")
	}
}

// Public is what one participant may see of another. Anything added to User
// later must not leak through it by accident.
func TestPublicProfileCarriesOnlyRosterFields(t *testing.T) {
	u := &models.User{
		UserID:               "u1",
		DisplayName:          "Someone",
		CollegeName:          "Thapar Institute",
		Email:                "someone@thapar.edu",
		PhoneNumber:          "9999999999",
		RollNumber:           "102103999",
		IsHostCollegeStudent: true,
	}

	p := u.Public()
	if p.UserID != "u1" || p.DisplayName != "Someone" || p.CollegeName != "Thapar Institute" {
		t.Errorf("roster fields missing: %+v", p)
	}
	if !p.IsHostCollegeStudent {
		t.Error("the host flag should carry over")
	}
	// The compiler enforces the rest: PublicProfile has no email, phone or roll
	// number field, so a teammate cannot read them.
}
