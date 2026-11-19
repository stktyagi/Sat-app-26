package models

// AuditActor represents the staff member / admin who performed an action.
type AuditActor struct {
	UserID string   `json:"userId" firestore:"userId"`
	Name   string   `json:"name" firestore:"name"`
	Email  string   `json:"email" firestore:"email"`
	Roles  []string `json:"roles" firestore:"roles"`
}

// AuditTarget represents the user / participant who was affected by the action.
type AuditTarget struct {
	UserID      string `json:"userId" firestore:"userId"`
	Name        string `json:"name" firestore:"name"`
	Email       string `json:"email" firestore:"email"`
	Phone       string `json:"phone,omitempty" firestore:"phone,omitempty"`
	CollegeName string `json:"collegeName,omitempty" firestore:"collegeName,omitempty"`
}

// AuditLog represents a single audit trail entry in the database.
type AuditLog struct {
	ID           string         `json:"id" firestore:"-"`
	Action       string         `json:"action" firestore:"action"`
	Category     string         `json:"category" firestore:"category"`
	PerformedBy  AuditActor     `json:"performedBy" firestore:"performedBy"`
	AffectedUser *AuditTarget   `json:"affectedUser,omitempty" firestore:"affectedUser,omitempty"`
	Details      map[string]any `json:"details" firestore:"details"`
	CreatedAt    string         `json:"createdAt" firestore:"createdAt"`
	CreatedAtIST string         `json:"createdAtIST" firestore:"createdAtIST"`
}
