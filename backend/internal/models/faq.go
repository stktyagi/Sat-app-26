package models

// Faq is one question on the public FAQ page, shown in ascending Order.
type Faq struct {
	// ID refers to document id and is not written upstream
	ID string `json:"id" firestore:"-"`

	Question string `json:"question" firestore:"question"`
	Answer   string `json:"answer"   firestore:"answer"`
	Order    int    `json:"order"    firestore:"order"`
}
