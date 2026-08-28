package models

import "strings"

// Roles. The live users collection also contains "event-coordinator" from last
// year, but this API models two roles only — anyone holding the legacy value is
// treated as a plain user.
const (
	RoleUser  = "user"
	RoleAdmin = "admin"
)

type User struct {
	UserID               string   `json:"userId"`
	Email                string   `json:"email"`
	DisplayName          string   `json:"displayName"`
	PhoneNumber          string   `json:"phoneNumber"`
	RollNumber           string   `json:"rollNumber"`
	CollegeName          string   `json:"collegeName"`
	Role                 string   `json:"role"`
	PhotoURL             string   `json:"photoURL"`
	Gender               string   `json:"gender"`
	Age                  string   `json:"age"`
	GraduationYear       string   `json:"graduationYear"`
	Interests            []string `json:"interests"`
	IsHostCollegeStudent bool     `json:"isHostCollegeStudent"`
	FullyRegistered      bool     `json:"fullyRegistered"`
	IsVerified           bool     `json:"isVerified"`
	IsAmbassador         bool     `json:"isAmbassador"`
	AccommodationNeeded  bool     `json:"accommodationNeeded"`
	ReferralCode         string   `json:"referralCode"`
	ReferredBy           string   `json:"referredBy"`
	Coins                int      `json:"coins"`
	CreatedAt            string   `json:"createdAt"`
}

func (u *User) IsAdmin() bool { return u != nil && u.Role == RoleAdmin }

func UserFromDoc(id string, m map[string]any) *User {
	u := &User{
		UserID:               Str(Coalesce(m["userId"], id)),
		Email:                Str(m["email"]),
		DisplayName:          Str(Coalesce(m["displayName"], m["name"])),
		PhoneNumber:          Str(m["phoneNumber"]),
		RollNumber:           Str(m["rollNumber"]),
		CollegeName:          Str(m["collegeName"]),
		Role:                 Str(m["role"]),
		PhotoURL:             Str(m["photoURL"]),
		Gender:               Gender(m["gender"]),
		Age:                  Str(m["age"]),
		GraduationYear:       Str(m["graduationYear"]),
		Interests:            StrSlice(m["interests"]),
		IsHostCollegeStudent: Bool(m["isHostCollegeStudent"]),
		FullyRegistered:      Bool(m["fullyRegistered"]),
		IsVerified:           Bool(m["isVerified"]),
		IsAmbassador:         Bool(m["isAmbassador"]),
		AccommodationNeeded:  Bool(m["accommodationNeeded"]),
		ReferralCode:         Str(m["referralCode"]),
		ReferredBy:           Str(m["referredBy"]),
		Coins:                Int(m["coins"]),
		CreatedAt:            Str(m["createdAt"]),
	}
	if u.Role != RoleAdmin {
		u.Role = RoleUser
	}
	if u.Interests == nil {
		u.Interests = []string{}
	}
	return u
}

// RegistrationSnapshot is the denormalised `user` block copied onto every
// registration document, matching the existing field names exactly.
func (u *User) RegistrationSnapshot() map[string]any {
	return map[string]any{
		"name":        u.DisplayName,
		"email":       u.Email,
		"phoneNumber": u.PhoneNumber,
		"rollNumber":  u.RollNumber,
		"collegeName": u.CollegeName,
	}
}

// TeamMember is the slim member record written into teamRegistrations.members.
// Last year's documents embedded the entire user document here — all 29 fields
// including the FCM push token, appleId and coinsHistory — into a document every
// teammate can read. New writes carry only what a UI actually renders.
func (u *User) TeamMember(joinedAt string) map[string]any {
	return map[string]any{
		"userId":               u.UserID,
		"name":                 u.DisplayName,
		"displayName":          u.DisplayName,
		"email":                u.Email,
		"phoneNumber":          u.PhoneNumber,
		"rollNumber":           u.RollNumber,
		"collegeName":          u.CollegeName,
		"photoURL":             u.PhotoURL,
		"isHostCollegeStudent": u.IsHostCollegeStudent,
		"joinedAt":             joinedAt,
	}
}

// IsHostEmail decides the host-vs-external split that drives event pricing and
// sameCollegeOnly gating.
func IsHostEmail(email, hostDomain string) bool {
	at := strings.LastIndex(email, "@")
	if at < 0 {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(email[at+1:]), hostDomain)
}
