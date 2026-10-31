package models

import "testing"

func TestNewPaymentChargesAtLeastOne(t *testing.T) {
	bill := map[string]any{"event": 500, "total": 500}
	p := NewPayment("id", "u", "e", "", PaymentTypeEvent, 500, 500, "FREE", nil, ProcessedIntentions{}, bill)
	if p.FinalAmount != 1 {
		t.Errorf("a fully discounted cart is charged the gateway minimum, got %d", p.FinalAmount)
	}
	if p.Bill["event"] != 500 {
		t.Errorf("bill should preserve items, got %+v", p.Bill)
	}
	p = NewPayment("id", "u", "e", "", PaymentTypeEvent, 500, 100, "C", nil, ProcessedIntentions{}, nil)
	if p.OriginalAmount != 500 || p.DiscountAmount != 100 || p.FinalAmount != 400 {
		t.Errorf("amounts should stay truthful: %+v", p)
	}
}

func TestFingerprintTellsCartsApart(t *testing.T) {
	mk := func(acc map[string]any, covered ...string) *Payment {
		return NewPayment("id", "u", "e", "t", PaymentTypeEvent, 500, 0, "", nil, ProcessedIntentions{
			EventRegistration: &EventRegistrationIntention{CoveredUserIDs: covered},
			Accommodation:     acc,
		}, nil)
	}
	base := mk(map[string]any{"day1": true}, "a", "b").Fingerprint()

	if base != mk(map[string]any{"day1": true, "day2": false}, "b", "a").Fingerprint() {
		t.Error("member order and unselected days must not change the fingerprint")
	}
	if base == mk(map[string]any{"day1": true}, "a", "b", "c").Fingerprint() {
		t.Error("a different roster is a different cart")
	}
	if base == mk(map[string]any{"day1": true, "day2": true}, "a", "b").Fingerprint() {
		t.Error("a different set of days is a different cart")
	}
}
