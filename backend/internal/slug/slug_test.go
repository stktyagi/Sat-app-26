package slug

import "testing"

func TestMake(t *testing.T) {
	cases := []struct{ in, want string }{
		// The IDs these produce match the convention already in the database.
		{"3D Printing Workshop", "3d-printing-workshop"},
		{"50 Hour Film Making", "50-hour-film-making"},
		{"Aero Genesis", "aero-genesis"},
		{"  Spaced   Out  ", "spaced-out"},
		{"Punctuation! & Symbols?", "punctuation-symbols"},
		{"---leading and trailing---", "leading-and-trailing"},
		{"", ""},
		{"!!!", ""},
	}
	for _, tc := range cases {
		if got := Make(tc.in); got != tc.want {
			t.Errorf("Make(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
