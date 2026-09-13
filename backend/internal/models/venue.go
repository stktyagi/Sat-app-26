package models

// Venue is a location on the campus map. VenueID is a kebab-case slug of the
// name and doubles as the document ID, which is what events reference.
type Venue struct {
	VenueID   string  `json:"venueId"   firestore:"venueId"`
	VenueName string  `json:"venueName" firestore:"venueName"`
	Lat       float64 `json:"lat"       firestore:"lat"`
	Lng       float64 `json:"lng"       firestore:"lng"`
}
