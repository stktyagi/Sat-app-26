package store

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"

	"cloud.google.com/go/firestore"

	"backend/internal/config"
	"backend/internal/models"
)

// These run against the Firestore emulator and skip without it:
//
//	firebase emulators:start --only firestore
//	FIRESTORE_EMULATOR_HOST=localhost:8081 go test ./internal/store -run Payment
func emulatorStore(t *testing.T) *Store {
	t.Helper()
	if os.Getenv("FIRESTORE_EMULATOR_HOST") == "" {
		t.Skip("FIRESTORE_EMULATOR_HOST not set")
	}
	fs, err := firestore.NewClient(context.Background(), "demo-payments-test")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { fs.Close() })
	return New(fs, &config.Config{})
}

// seed writes a user, their registration and a payment, with unique IDs per test.
func seed(t *testing.T, s *Store, coupon string) (*models.Payment, string) {
	t.Helper()
	ctx := context.Background()
	n := t.Name()
	uid, eid := "u-"+n, "e-"+n

	mustWrite(t)(s.FS.Collection(ColUsers).Doc(uid).Set(ctx, map[string]any{"userId": uid, "email": "a@b.c"}))
	mustWrite(t)(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(eid, uid)).Set(ctx,
		models.NewRegistration(uid, eid, "", "", 500, nil)))

	p := models.NewPayment("pay-"+n, uid, eid, "", models.PaymentTypeEventAndAccommodation, 800, 0, coupon, nil,
		models.ProcessedIntentions{
			EventRegistration: &models.EventRegistrationIntention{EventID: eid, EventType: "individual", CoveredUserIDs: []string{uid}},
			Accommodation:     map[string]any{"day1": true},
		}, nil)
	got, _, err := s.BeginCheckout(ctx, uid+"_"+eid, p)
	must(t, err)
	return got, uid
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

// mustWrite(t)(doc.Set(...)) checks the error of a Firestore write.
func mustWrite(t *testing.T) func(*firestore.WriteResult, error) {
	return func(_ *firestore.WriteResult, err error) {
		t.Helper()
		must(t, err)
	}
}

func TestPaymentCheckoutIsIdempotent(t *testing.T) {
	s := emulatorStore(t)
	ctx := context.Background()
	p, uid := seed(t, s, "")
	key := uid + "_" + p.EventID

	// Same cart before the link exists: a second creation must not start.
	again := *p
	again.MerchantOrderID = "other-" + p.MerchantOrderID
	if _, _, err := s.BeginCheckout(ctx, key, &again); !errors.Is(err, ErrCheckoutBusy) {
		t.Fatalf("want ErrCheckoutBusy, got %v", err)
	}

	// Once the link is stored, a retry gets the same payment and link back.
	must(t, s.SetCheckoutURL(ctx, key, p.MerchantOrderID, "https://pay/x"))
	got, co, err := s.BeginCheckout(ctx, key, &again)
	must(t, err)
	if got.MerchantOrderID != p.MerchantOrderID || co.PaymentURL != "https://pay/x" {
		t.Errorf("retry should return the live checkout, got %s / %q", got.MerchantOrderID, co.PaymentURL)
	}

	// A changed cart replaces it.
	changed := again
	changed.ProcessedIntentions.Accommodation = map[string]any{"day1": true, "day2": true}
	got, _, err = s.BeginCheckout(ctx, key, &changed)
	must(t, err)
	if got.MerchantOrderID != changed.MerchantOrderID {
		t.Errorf("a different cart should open a new payment")
	}
}

func TestPaymentSettlesOnce(t *testing.T) {
	s := emulatorStore(t)
	ctx := context.Background()
	p, uid := seed(t, s, "SAVE")

	var wg sync.WaitGroup
	var mu sync.Mutex
	applied := 0
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			already, err := s.SettlePayment(ctx, p.MerchantOrderID, SettleInfo{TxnID: "ez1"})
			if err != nil {
				t.Error(err)
				return
			}
			if !already {
				mu.Lock()
				applied++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if applied != 1 {
		t.Errorf("exactly one settlement may apply, %d did", applied)
	}

	usage, _ := s.FS.Collection(ColCouponUsage).Where("couponCode", "==", "SAVE").Documents(ctx).GetAll()
	if len(usage) != 1 {
		t.Errorf("want 1 coupon usage, got %d", len(usage))
	}
	u, err := s.GetUser(ctx, uid)
	must(t, err)
	if len(u.AccommodationTransactionIds) != 1 || !u.Accommodation["day1"] {
		t.Errorf("accommodation should be applied once: %+v", u.AccommodationTransactionIds)
	}
	reg, err := s.GetRegistration(ctx, models.RegistrationID(p.EventID, uid))
	must(t, err)
	if reg.PaymentStatus != models.RegPaymentSuccess || reg.PaidAt == "" {
		t.Errorf("registration not marked paid: %+v", reg)
	}

	// A failure arriving after success must not undo it.
	must(t, s.MarkPaymentFailed(ctx, p.MerchantOrderID, "", ""))
	after, err := s.GetPayment(ctx, p.MerchantOrderID)
	must(t, err)
	if after.Status != models.PaymentStatusSuccess {
		t.Errorf("late failure overwrote success: %s", after.Status)
	}
}

func TestPaymentLateSuccessAfterFailure(t *testing.T) {
	s := emulatorStore(t)
	ctx := context.Background()
	p, _ := seed(t, s, "")

	must(t, s.MarkPaymentFailed(ctx, p.MerchantOrderID, "ez", ""))
	if already, err := s.SettlePayment(ctx, p.MerchantOrderID, SettleInfo{TxnID: "ez"}); err != nil || already {
		t.Fatalf("a failed payment can still settle: already=%v err=%v", already, err)
	}
}

func TestPaymentSettleSkipsCancelledRegistration(t *testing.T) {
	s := emulatorStore(t)
	ctx := context.Background()
	p, uid := seed(t, s, "")
	regID := models.RegistrationID(p.EventID, uid)
	must(t, s.DeleteRegistration(ctx, regID))

	_, err := s.SettlePayment(ctx, p.MerchantOrderID, SettleInfo{TxnID: "ez"})
	must(t, err)

	if _, err := s.GetRegistration(ctx, regID); !errors.Is(err, ErrNotFound) {
		t.Errorf("settlement must not recreate a cancelled registration, got %v", err)
	}
	after, err := s.GetPayment(ctx, p.MerchantOrderID)
	must(t, err)
	if len(after.OrphanedUserIDs) != 1 || after.OrphanedUserIDs[0] != uid {
		t.Errorf("the orphaned user should be recorded: %v", after.OrphanedUserIDs)
	}
}

func TestPaymentLocksTeamRoster(t *testing.T) {
	s := emulatorStore(t)
	ctx := context.Background()
	eid, code := "e-"+t.Name(), "ABC123"
	team := models.NewTeam(eid, code, "Team", "leader", 1, nil)
	mustWrite(t)(s.FS.Collection(ColTeams).Doc(team.TeamID).Set(ctx, team))

	join := func(uid string) error {
		reg := models.NewRegistration(uid, eid, team.TeamID, code, 500, nil)
		_, err := s.JoinTeam(ctx, team.TeamID, uid, models.RegistrationID(eid, uid), reg, 1, 0, true)
		return err
	}

	// An open checkout freezes the roster.
	p := models.NewPayment("pay-"+t.Name(), "leader", eid, team.TeamID, models.PaymentTypeEvent, 500, 0, "", nil,
		models.ProcessedIntentions{EventRegistration: &models.EventRegistrationIntention{CoveredUserIDs: []string{"leader"}}}, nil)
	_, _, err := s.BeginCheckout(ctx, team.TeamID, p)
	must(t, err)
	if err := join("late"); !errors.Is(err, ErrTeamLocked) {
		t.Fatalf("join during checkout: want ErrTeamLocked, got %v", err)
	}

	// Joining is allowed after checkout finishes, even if team is already confirmed or paid.
	must(t, s.MarkPaymentFailed(ctx, p.MerchantOrderID, "", ""))
	if err := join("early"); err != nil {
		t.Fatalf("join after a failed checkout should work: %v", err)
	}

	// A paid team still takes members, and joining clears paid so the leader
	// can pay the difference.
	mustWrite(t)(s.FS.Collection(ColTeams).Doc(team.TeamID).Update(ctx, []firestore.Update{
		{Path: "paid", Value: true},
		{Path: "status", Value: models.TeamStatusConfirmed},
	}))
	if err := join("after-paid"); err != nil {
		t.Fatalf("join after payment should work: %v", err)
	}
	got, err := s.GetTeam(ctx, team.TeamID)
	must(t, err)
	if got.Paid {
		t.Error("joining a paid team must clear paid")
	}
}

func TestPaymentRosterMustMatchAtCheckout(t *testing.T) {
	s := emulatorStore(t)
	ctx := context.Background()
	eid, code := "e-"+t.Name(), "ABC123"
	team := models.NewTeam(eid, code, "Team", "leader", 1, nil)
	mustWrite(t)(s.FS.Collection(ColTeams).Doc(team.TeamID).Set(ctx, team))

	// Priced for [leader, ghost] but the team is just [leader].
	p := models.NewPayment("pay-"+t.Name(), "leader", eid, team.TeamID, models.PaymentTypeEvent, 500, 0, "", nil,
		models.ProcessedIntentions{EventRegistration: &models.EventRegistrationIntention{CoveredUserIDs: []string{"leader", "ghost"}}}, nil)
	if _, _, err := s.BeginCheckout(ctx, team.TeamID, p); !errors.Is(err, ErrRosterChanged) {
		t.Fatalf("want ErrRosterChanged, got %v", err)
	}
}

func TestPaymentIgnoresRegistrationOfAnotherTeam(t *testing.T) {
	s := emulatorStore(t)
	ctx := context.Background()
	eid := "e-" + t.Name()

	// "mover" has left team A and registered under team B.
	mustWrite(t)(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(eid, "mover")).Set(ctx,
		models.NewRegistration("mover", eid, "teamB", "B", 500, nil)))
	mustWrite(t)(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(eid, "leader")).Set(ctx,
		models.NewRegistration("leader", eid, "teamA", "A", 500, nil)))
	mustWrite(t)(s.FS.Collection(ColTeams).Doc("teamA").Set(ctx, models.NewTeam(eid, "A", "A", "leader", 1, nil)))

	p := models.NewPayment("pay-"+t.Name(), "leader", eid, "teamA", models.PaymentTypeEvent, 1000, 0, "", nil,
		models.ProcessedIntentions{EventRegistration: &models.EventRegistrationIntention{CoveredUserIDs: []string{"leader", "mover"}}}, nil)
	mustWrite(t)(s.FS.Collection(ColPayments).Doc(p.MerchantOrderID).Set(ctx, p))

	_, err := s.SettlePayment(ctx, p.MerchantOrderID, SettleInfo{TxnID: "ez"})
	must(t, err)

	reg, err := s.GetRegistration(ctx, models.RegistrationID(eid, "mover"))
	must(t, err)
	if reg.PaymentStatus == models.RegPaymentSuccess {
		t.Error("a registration on another team must not be marked paid by this payment")
	}
	after, err := s.GetPayment(ctx, p.MerchantOrderID)
	must(t, err)
	if len(after.OrphanedUserIDs) != 1 || after.OrphanedUserIDs[0] != "mover" {
		t.Errorf("mover should be recorded as orphaned: %v", after.OrphanedUserIDs)
	}
}

func TestPaymentLeavesTeamUnpaidWhenSomeoneJoinedLate(t *testing.T) {
	s := emulatorStore(t)
	ctx := context.Background()
	eid := "e-" + t.Name()
	team := models.NewTeam(eid, "A", "A", "leader", 1, nil)
	team.MemberIDs = []string{"leader", "late"}
	mustWrite(t)(s.FS.Collection(ColTeams).Doc(team.TeamID).Set(ctx, team))
	for _, u := range []string{"leader", "late"} {
		mustWrite(t)(s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(eid, u)).Set(ctx,
			models.NewRegistration(u, eid, team.TeamID, "A", 500, nil)))
	}

	// Priced for the leader alone; "late" joined after the checkout expired.
	p := models.NewPayment("pay-"+t.Name(), "leader", eid, team.TeamID, models.PaymentTypeEvent, 500, 0, "", nil,
		models.ProcessedIntentions{EventRegistration: &models.EventRegistrationIntention{CoveredUserIDs: []string{"leader"}, Amount: 500}}, nil)
	mustWrite(t)(s.FS.Collection(ColPayments).Doc(p.MerchantOrderID).Set(ctx, p))

	_, err := s.SettlePayment(ctx, p.MerchantOrderID, SettleInfo{TxnID: "ez"})
	must(t, err)

	got, err := s.GetTeam(ctx, team.TeamID)
	must(t, err)
	if got.Paid {
		t.Error("a team with an uncovered member must stay unpaid")
	}
	if got.PaidTill != 500 {
		t.Errorf("paidTill should record the settled event fee: got %d", got.PaidTill)
	}
	after, err := s.GetPayment(ctx, p.MerchantOrderID)
	must(t, err)
	if len(after.UncoveredUserIDs) != 1 || after.UncoveredUserIDs[0] != "late" {
		t.Errorf("late joiner should be flagged: %v", after.UncoveredUserIDs)
	}
}
