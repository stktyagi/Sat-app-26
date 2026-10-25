package models

import (
	"crypto/sha256"
	"fmt"
	"slices"
	"sort"
	"strings"
	"time"

	"backend/internal/isotime"
)

// Payment statuses
const (
	PaymentStatusPending = "pending"
	PaymentStatusSuccess = "success"
	PaymentStatusFailure = "failure"

	// PaymentType values
	PaymentTypeEvent                        = "event"
	PaymentTypeAccommodation                = "accommodation"
	PaymentTypeAccommodationAndFood         = "accommodation_and_food"
	PaymentTypeEventAndAccommodation        = "event_and_accommodation"
	PaymentTypeEventAndAccommodationAndFood = "event_and_accommodation_and_food"

	// EventPaymentType (per-individual or per-team)
	EventPaymentTypeIndividual = "individual"
	EventPaymentTypeTeam       = "team"
)

// EventRegistrationIntention is the nested map inside processedIntentions.eventRegistration.
type EventRegistrationIntention struct {
	EventID   string `json:"eventId"   firestore:"eventId"`
	EventType string `json:"eventType" firestore:"eventType"` // "individual" | "team"
	TeamID    string `json:"teamId"    firestore:"teamId"`
	TeamName  string `json:"teamName"  firestore:"teamName"`
	Amount    int    `json:"amount"    firestore:"amount"` // event portion of the charge, before discount
	// CoveredUserIDs are the users whose registrations this payment settles:
	// the team roster at checkout time, or just the payer.
	CoveredUserIDs []string `json:"coveredUserIds" firestore:"coveredUserIds"`
}

// ProcessedIntentions holds what the payment covers.
type ProcessedIntentions struct {
	EventRegistration *EventRegistrationIntention `json:"eventRegistration" firestore:"eventRegistration"`
	Accommodation     map[string]any              `json:"accommodation"     firestore:"accommodation"`
	Food              map[string]any              `json:"food"              firestore:"food"`
}

type CouponDetails struct {
	Code          string  `json:"code"          firestore:"code"`
	DiscountType  string  `json:"discountType"  firestore:"discountType"`
	DiscountValue float64 `json:"discountValue" firestore:"discountValue"`
}

// Payment is a document in the "payments" Firestore collection.
// MerchantOrderID is also the document ID.
type Payment struct {
	// ID is the document ID — same value as MerchantOrderID.
	ID string `json:"id" firestore:"-"`

	MerchantOrderID string `json:"merchantOrderId" firestore:"merchantOrderId"`
	UserID          string `json:"userId"          firestore:"userId"`
	EventID         string `json:"eventId"         firestore:"eventId"`
	TeamID          string `json:"teamId"          firestore:"teamId"`

	PaymentType string `json:"paymentType" firestore:"paymentType"`

	OriginalAmount  int `json:"originalAmount"  firestore:"originalAmount"`
	DiscountAmount  int `json:"discountAmount"  firestore:"discountAmount"`
	TransactionFees int `json:"transactionFees" firestore:"transactionFees"`
	FinalAmount     int `json:"finalAmount"     firestore:"finalAmount"`

	CouponCode    string         `json:"couponCode,omitempty"    firestore:"couponCode"`
	CouponDetails *CouponDetails `json:"couponDetails,omitempty" firestore:"couponDetails"`

	Bill map[string]any `json:"bill" firestore:"bill"`

	ProcessedIntentions ProcessedIntentions `json:"processedIntentions" firestore:"processedIntentions"`

	Status      string `json:"status"                firestore:"status"`
	CreatedAt   string `json:"createdAt"             firestore:"createdAt"`
	CompletedAt string `json:"completedAt,omitempty" firestore:"completedAt"`

	// Easebuzz-specific fields stored for audit / webhook verification.
	EasebuzzTxnID  string `json:"easebuzzTxnId,omitempty"  firestore:"easebuzzTxnId"`
	NetAmountDebit string `json:"netAmountDebit,omitempty" firestore:"netAmountDebit"`

	// CheckoutID names the checkouts document that guards this payment against
	// double taps. Empty on payments created before checkouts existed.
	CheckoutID string `json:"checkoutId,omitempty" firestore:"checkoutId"`

	// Settlement flags for organisers: Duplicate means the registration was
	// already paid when this payment settled (refund manually); OrphanedUserIDs
	// are covered users whose registration was gone by then.
	Duplicate       bool     `json:"duplicate,omitempty"       firestore:"duplicate"`
	OrphanedUserIDs []string `json:"orphanedUserIds,omitempty" firestore:"orphanedUserIds"`
	// UncoveredUserIDs are team members who joined after this payment's roster
	// was fixed; the team is left unpaid so they can still be charged.
	UncoveredUserIDs []string `json:"uncoveredUserIds,omitempty" firestore:"uncoveredUserIds"`

	OverriddenBy string `json:"overriddenBy,omitempty" firestore:"overriddenBy"`
	OverriddenAt string `json:"overriddenAt,omitempty" firestore:"overriddenAt"`
}

// Checkout is the double-tap guard: one live document per payer-and-purpose
// (team ID, "{userId}_{eventId}" or "{userId}_stay"). A repeat initiate with the
// same fingerprint gets the same payment back instead of a second charge.
type Checkout struct {
	PaymentID   string `firestore:"paymentId"`
	PaymentURL  string `firestore:"paymentUrl"`
	Fingerprint string `firestore:"fingerprint"`
	CreatedAt   string `firestore:"createdAt"`
	ExpiresAt   string `firestore:"expiresAt"`
}

// Fingerprint identifies what a checkout buys, so a changed cart is told apart
// from a retried one.
func (p *Payment) Fingerprint() string {
	var b strings.Builder
	fmt.Fprintf(&b, "%d|%d|%s|%s|%s", p.OriginalAmount, p.FinalAmount, p.CouponCode, p.EventID, p.PaymentType)
	if e := p.ProcessedIntentions.EventRegistration; e != nil {
		ids := slices.Clone(e.CoveredUserIDs)
		sort.Strings(ids)
		fmt.Fprintf(&b, "|%s", strings.Join(ids, ","))
	}
	for _, m := range []map[string]any{p.ProcessedIntentions.Accommodation, p.ProcessedIntentions.Food} {
		keys := make([]string, 0, len(m))
		for k, v := range m {
			if on, _ := v.(bool); on {
				keys = append(keys, k)
			}
		}
		sort.Strings(keys)
		fmt.Fprintf(&b, "|%s", strings.Join(keys, ","))
	}
	return fmt.Sprintf("%x", sha256.Sum256([]byte(b.String())))
}

// NewPaymentID generates the merchantOrderId / document ID:
// "SAT25-{date}-{time}-{rand}"
// rand should be a random hex string; 8 characters keep same-second collisions
// negligible.
func NewPaymentID(rand string) string {
	now := time.Now().UTC()
	return fmt.Sprintf("SAT25-%s-%s", now.Format("20060102-150405"), rand)
}

// NewPayment constructs a Payment ready to be stored.
func NewPayment(
	merchantOrderID, userID, eventID, teamID string,
	paymentType string,
	originalAmount, discountAmount int,
	couponCode string, couponDetails *CouponDetails,
	intentions ProcessedIntentions,
	bill map[string]any,
) *Payment {
	// The gateway rejects a zero amount, so a fully discounted cart is still
	// charged the minimum of 1. FinalAmount is what is actually charged.
	final := max(originalAmount-discountAmount, 1)
	if bill == nil {
		bill = map[string]any{}
	}
	return &Payment{
		MerchantOrderID:     merchantOrderID,
		UserID:              userID,
		EventID:             eventID,
		TeamID:              teamID,
		PaymentType:         paymentType,
		OriginalAmount:      originalAmount,
		DiscountAmount:      discountAmount,
		TransactionFees:     0,
		FinalAmount:         final,
		CouponCode:          couponCode,
		CouponDetails:       couponDetails,
		Bill:                bill,
		ProcessedIntentions: intentions,
		Status:              PaymentStatusPending,
		CreatedAt:           isotime.Now(),
	}
}
