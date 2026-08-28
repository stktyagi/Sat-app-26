package models

import "testing"

// The values below are the ones actually observed in the production data, not
// invented edge cases: maxParticipants really is sometimes "" and sometimes a
// number, and graduationYear really is stored both as "2029" and as 2027.

func TestInt(t *testing.T) {
	cases := []struct {
		name string
		in   any
		want int
	}{
		{"absent field", nil, 0},
		{"empty string means unlimited", "", 0},
		{"firestore integer", int64(1000), 1000},
		{"firestore float", float64(6), 6},
		{"numeric string", "5", 5},
		{"padded numeric string", " 8 ", 8},
		{"unparseable string", "many", 0},
		{"wrong type", true, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := Int(tc.in); got != tc.want {
				t.Errorf("Int(%#v) = %d, want %d", tc.in, got, tc.want)
			}
		})
	}
}

func TestStr(t *testing.T) {
	cases := []struct {
		name string
		in   any
		want string
	}{
		{"graduationYear as string", "2029", "2029"},
		{"graduationYear as float", float64(2027), "2027"},
		{"graduationYear as int64", int64(2026), "2026"},
		{"nil", nil, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := Str(tc.in); got != tc.want {
				t.Errorf("Str(%#v) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestCoalesceResolvesLegacyFieldPairs(t *testing.T) {
	// coverImage on newer docs, coverImageUrl on older ones.
	if got := Str(Coalesce(nil, "https://example.test/a.jpg")); got != "https://example.test/a.jpg" {
		t.Errorf("fell through to the legacy field incorrectly: %q", got)
	}
	// An empty string must not win over a populated legacy value.
	if got := Str(Coalesce("", "legacy")); got != "legacy" {
		t.Errorf("empty string should not shadow the legacy value, got %q", got)
	}
	// A populated canonical value wins.
	if got := Str(Coalesce("canonical", "legacy")); got != "canonical" {
		t.Errorf("canonical value should win, got %q", got)
	}
	// An empty array must not shadow a populated legacy value either.
	if got := StrSlice(Coalesce([]any{}, "a,b")); len(got) != 2 {
		t.Errorf("empty array should not shadow additionalImages, got %#v", got)
	}
}

func TestStrSliceAcceptsBothShapes(t *testing.T) {
	fromArray := StrSlice([]any{"a", "b"})
	fromCSV := StrSlice("a, b")
	if len(fromArray) != 2 || len(fromCSV) != 2 {
		t.Fatalf("expected two entries from both shapes, got %#v and %#v", fromArray, fromCSV)
	}
	if fromCSV[1] != "b" {
		t.Errorf("csv entries should be trimmed, got %q", fromCSV[1])
	}
	if got := StrSlice(""); got != nil {
		t.Errorf("empty string should yield no entries, got %#v", got)
	}
}

func TestGenderNormalisation(t *testing.T) {
	for _, in := range []string{"male", "Male", " MALE "} {
		if got := Gender(in); got != "male" {
			t.Errorf("Gender(%q) = %q, want male", in, got)
		}
	}
}

func TestEventFromDocHandlesLegacyDocument(t *testing.T) {
	// A document written by the older admin panel: flat fee fields, the
	// coverImageUrl spelling, requireAdminApproval, and maxParticipants as "".
	e := EventFromDoc("legacy-event", map[string]any{
		"title":                "Legacy Event",
		"category":             "Technical",
		"eventType":            "individual",
		"coverImageUrl":        "https://example.test/cover.jpg",
		"additionalImages":     "https://example.test/1.jpg,https://example.test/2.jpg",
		"hostFee":              "10",
		"otherFee":             float64(20),
		"paymentEnabled":       true,
		"requireAdminApproval": true,
		"maxParticipants":      "",
		"dateTime":             "2025-11-13T10:30:00.000Z",
	})

	if e.CoverImage != "https://example.test/cover.jpg" {
		t.Errorf("coverImageUrl not resolved: %q", e.CoverImage)
	}
	if len(e.Images) != 2 {
		t.Errorf("additionalImages not split: %#v", e.Images)
	}
	if e.RegistrationFee.Host != 10 || e.RegistrationFee.Other != 20 {
		t.Errorf("flat fee fields not resolved: %#v", e.RegistrationFee)
	}
	if !e.PaymentRequired {
		t.Error("paymentEnabled should satisfy paymentRequired")
	}
	if !e.RequiresApproval {
		t.Error("requireAdminApproval should satisfy requiresApproval")
	}
	if !e.Unlimited() {
		t.Errorf("empty maxParticipants should mean unlimited, got %d", e.MaxParticipants)
	}
	// startDateTime is absent on this document, so it falls back to dateTime.
	if e.StartDateTime != "2025-11-13T10:30:00.000Z" {
		t.Errorf("startDateTime should fall back to dateTime, got %q", e.StartDateTime)
	}
}

func TestFeeForSplitsHostAndExternal(t *testing.T) {
	e := &Event{PaymentRequired: true, RegistrationFee: Fee{Host: 10, Other: 20}}
	if got := e.FeeFor(true); got != 10 {
		t.Errorf("host fee = %d, want 10", got)
	}
	if got := e.FeeFor(false); got != 20 {
		t.Errorf("external fee = %d, want 20", got)
	}

	free := &Event{PaymentRequired: false, RegistrationFee: Fee{Host: 10, Other: 20}}
	if got := free.FeeFor(false); got != 0 {
		t.Errorf("a free event should charge nothing even with a fee map, got %d", got)
	}
}

func TestIsHostEmail(t *testing.T) {
	if !IsHostEmail("someone@thapar.edu", "thapar.edu") {
		t.Error("host domain should match")
	}
	if !IsHostEmail("someone@THAPAR.EDU", "thapar.edu") {
		t.Error("domain match should be case-insensitive")
	}
	if IsHostEmail("someone@gmail.com", "thapar.edu") {
		t.Error("external domain should not match")
	}
	if IsHostEmail("notanemail", "thapar.edu") {
		t.Error("a malformed address should not match")
	}
	// A domain that merely ends with the host domain must not pass.
	if IsHostEmail("someone@notthapar.edu", "thapar.edu") {
		t.Error("suffix collision should not match")
	}
}

// Firestore hands back int64, but values constructed in Go are plain ints.
// Missing that case silently produced an empty string for the legacy hostFee
// mirror on every event write.
func TestStrHandlesNativeInt(t *testing.T) {
	if got := Str(10); got != "10" {
		t.Errorf("Str(int) = %q, want \"10\"", got)
	}
}
