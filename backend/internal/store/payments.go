package store

import (
	"context"
	"errors"
	"slices"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"backend/internal/isotime"
	"backend/internal/models"
)


const ColPayments = "payments"
const ColCheckouts = "checkouts"

// ErrCheckoutBusy means an identical checkout is being created right now and
// has no payment link yet; the caller should retry in a moment.
var ErrCheckoutBusy = errors.New("checkout in progress")

// ErrRosterChanged means the team's members are no longer the ones the payment
// was priced for.
var ErrRosterChanged = errors.New("team roster changed")

// CheckoutTTL is how long a checkout keeps a team locked and how long a retried
// initiate gets the same payment link back.
const CheckoutTTL = 30 * time.Minute

func (s *Store) GetPayment(ctx context.Context, id string) (*models.Payment, error) {
	doc, err := s.FS.Collection(ColPayments).Doc(id).Get(ctx)
	if err == nil {
		var p models.Payment
		if err := doc.DataTo(&p); err != nil {
			return nil, err
		}
		p.ID = doc.Ref.ID
		return &p, nil
	}
	if wrap(err) != ErrNotFound {
		return nil, wrap(err)
	}

	// Fallback to lookup by merchantOrderId field
	iter := s.FS.Collection(ColPayments).Where("merchantOrderId", "==", id).Limit(1).Documents(ctx)
	defer iter.Stop()
	doc, err = iter.Next()
	if err == iterator.Done {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, wrap(err)
	}
	var p models.Payment
	if err := doc.DataTo(&p); err != nil {
		return nil, err
	}
	p.ID = doc.Ref.ID
	return &p, nil
}

// BeginCheckout creates the payment, or hands back the live one when the same
// payer retries the same cart. Both happen in one transaction, so a double tap
// cannot produce two payments. The returned payment is the one to pay.
func (s *Store) BeginCheckout(ctx context.Context, checkoutID string, p *models.Payment) (*models.Payment, *models.Checkout, error) {
	coRef := s.FS.Collection(ColCheckouts).Doc(checkoutID)
	payRef := s.FS.Collection(ColPayments).Doc(p.MerchantOrderID)
	fp := p.Fingerprint()
	p.CheckoutID = checkoutID

	var existing *models.Payment
	var co *models.Checkout
	err := s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		existing, co = nil, nil
		now := time.Now()

		// A team payment covers the roster it was priced for. Checking it here,
		// in the same transaction that opens the checkout, closes the gap in
		// which someone could join between the handler's read and this write.
		if p.TeamID != "" {
			ts, err := tx.Get(s.FS.Collection(ColTeams).Doc(p.TeamID))
			if err != nil {
				return err
			}
			team, err := decodeTeam(ts)
			if err != nil {
				return err
			}
			if team.Paid {
				return ErrTeamLocked
			}
			var covered []string
			if e := p.ProcessedIntentions.EventRegistration; e != nil {
				covered = e.CoveredUserIDs
			}
			if !sameMembers(team.MemberIDs, covered) {
				return ErrRosterChanged
			}
		}

		snap, err := tx.Get(coRef)
		if err != nil && !errors.Is(wrap(err), ErrNotFound) {
			return err
		}
		if err == nil {
			var old models.Checkout
			if err := snap.DataTo(&old); err != nil {
				return err
			}
			if exp, ok := isotime.Parse(old.ExpiresAt); ok && exp.After(now) && old.Fingerprint == fp {
				if old.PaymentURL != "" {
					ps, err := tx.Get(s.FS.Collection(ColPayments).Doc(old.PaymentID))
					if err != nil {
						return err
					}
					var op models.Payment
					if err := ps.DataTo(&op); err != nil {
						return err
					}
					op.ID = ps.Ref.ID
					existing, co = &op, &old
					return nil
				}
				if created, ok := isotime.Parse(old.CreatedAt); ok && now.Sub(created) < time.Minute {
					return ErrCheckoutBusy
				}
			}
		}

		fresh := &models.Checkout{
			PaymentID:   p.MerchantOrderID,
			Fingerprint: fp,
			CreatedAt:   isotime.Format(now),
			ExpiresAt:   isotime.Format(now.Add(CheckoutTTL)),
		}
		if err := tx.Create(payRef, p); err != nil {
			return err
		}
		if err := tx.Set(coRef, fresh); err != nil {
			return err
		}
		co = fresh
		return nil
	})
	if err != nil {
		return nil, nil, wrap(err)
	}
	if existing != nil {
		return existing, co, nil
	}
	return p, co, nil
}

func sameMembers(a, b []string) bool {
	a, b = slices.Clone(a), slices.Clone(b)
	slices.Sort(a)
	slices.Sort(b)
	return slices.Equal(a, b)
}

// SetCheckoutURL records the gateway link once Easebuzz has issued it. Only
// from this point can a retried initiate reuse the checkout.
func (s *Store) SetCheckoutURL(ctx context.Context, checkoutID, paymentID, url string) error {
	ref := s.FS.Collection(ColCheckouts).Doc(checkoutID)
	return wrap(s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(ref)
		if err != nil {
			return err
		}
		if id, _ := snap.DataAt("paymentId"); id != paymentID {
			return nil // a newer checkout replaced this one
		}
		return tx.Update(ref, []firestore.Update{{Path: "paymentUrl", Value: url}})
	}))
}

// hasLiveCheckout reports whether an unexpired checkout exists at ref (a team ID).
// It runs inside the caller's transaction so a join cannot slip past a payment
// that is starting.
func hasLiveCheckout(tx *firestore.Transaction, ref *firestore.DocumentRef) (bool, error) {
	snap, err := tx.Get(ref)
	if err != nil {
		if errors.Is(wrap(err), ErrNotFound) {
			return false, nil
		}
		return false, err
	}
	s, _ := snap.DataAt("expiresAt")
	str, _ := s.(string)
	exp, ok := isotime.Parse(str)
	return ok && exp.After(time.Now()), nil
}

// SettleInfo is what the gateway (or an admin) reports about a successful payment.
type SettleInfo struct {
	TxnID          string
	NetAmountDebit string
	Fees           int
	AdminID        string // set when an admin forces the outcome
}

// SettlePayment applies a successful payment in one transaction: payment
// status, the covered registrations, the team's paid flag, the payer's
// accommodation and food, and the coupon usage. The first call applies it and
// every later call (webhook retry, redirect, admin) sees status success and
// changes nothing, so it is safe to call any number of times. It reports
// whether the payment had already been settled.
func (s *Store) SettlePayment(ctx context.Context, id string, info SettleInfo) (alreadySettled bool, err error) {
	payRef := s.FS.Collection(ColPayments).Doc(id)

	err = s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		alreadySettled = false

		// ---- reads (Firestore requires every read before the first write) ----
		psnap, err := tx.Get(payRef)
		if err != nil {
			return err
		}
		var p models.Payment
		if err := psnap.DataTo(&p); err != nil {
			return err
		}
		if p.Status == models.PaymentStatusSuccess {
			alreadySettled = true
			return nil
		}

		evt := p.ProcessedIntentions.EventRegistration
		covered := []string{}
		if evt != nil {
			covered = evt.CoveredUserIDs
			if len(covered) == 0 { // payments created before CoveredUserIDs existed
				covered = []string{p.UserID}
			}
		}

		regRefs := make([]*firestore.DocumentRef, len(covered))
		for i, uid := range covered {
			regRefs[i] = s.FS.Collection(ColRegistrations).Doc(models.RegistrationID(p.EventID, uid))
		}
		var regSnaps []*firestore.DocumentSnapshot
		if len(regRefs) > 0 {
			if regSnaps, err = tx.GetAll(regRefs); err != nil {
				return err
			}
		}

		var teamRef *firestore.DocumentRef
		if p.TeamID != "" {
			teamRef = s.FS.Collection(ColTeams).Doc(p.TeamID)
		}
		var teamSnap *firestore.DocumentSnapshot
		if teamRef != nil {
			if teamSnap, err = tx.Get(teamRef); err != nil && !errors.Is(wrap(err), ErrNotFound) {
				return err
			}
		}

		wantsStay := len(p.ProcessedIntentions.Accommodation) > 0 || len(p.ProcessedIntentions.Food) > 0
		userRef := s.FS.Collection(ColUsers).Doc(p.UserID)
		var user *models.User
		if wantsStay {
			usnap, err := tx.Get(userRef)
			if err != nil && !errors.Is(wrap(err), ErrNotFound) {
				return err
			}
			if err == nil {
				if user, err = decodeUser(usnap); err != nil {
					return err
				}
			}
		}

		var coRef *firestore.DocumentRef
		ownsCheckout := false
		if p.CheckoutID != "" {
			coRef = s.FS.Collection(ColCheckouts).Doc(p.CheckoutID)
			if cs, err := tx.Get(coRef); err == nil {
				pid, _ := cs.DataAt("paymentId")
				ownsCheckout = pid == id
			} else if !errors.Is(wrap(err), ErrNotFound) {
				return err
			}
		}

		// ---- decisions ----
		now := isotime.Now()
		orphans := []string{}
		alreadyPaid := 0
		settleRegs := make([]bool, len(regSnaps))
		for i, snap := range regSnaps {
			if !snap.Exists() {
				orphans = append(orphans, covered[i])
				continue
			}
			// The registration ID is eventId_userId, so a member who left this
			// team and joined another now has a registration that belongs to
			// someone else's payment.
			if tid, _ := snap.DataAt("teamId"); p.TeamID != "" && tid != p.TeamID {
				orphans = append(orphans, covered[i])
				continue
			}
			settleRegs[i] = true
			if st, _ := snap.DataAt("paymentStatus"); st == models.RegPaymentSuccess {
				alreadyPaid++
			}
		}

		// Members who joined after the roster was fixed are not covered. Leave
		// the team unpaid so the leader can pay again for the full roster.
		uncovered := []string{}
		markTeamPaid := teamSnap != nil && teamSnap.Exists()
		if markTeamPaid {
			// A team that can't be read is never marked paid: the payment itself
			// still settles, and the team is left for an organiser to fix.
			team, err := decodeTeam(teamSnap)
			if err != nil {
				markTeamPaid = false
			} else {
				for _, m := range team.MemberIDs {
					if !slices.Contains(covered, m) {
						uncovered = append(uncovered, m)
					}
				}
				markTeamPaid = len(uncovered) == 0
			}
		}
		// ponytail: the duplicate flag is only a pointer for a manual refund;
		// no refund is issued here.
		duplicate := alreadyPaid > 0 && alreadyPaid == len(covered)-len(orphans)

		// ---- writes ----
		upd := []firestore.Update{
			{Path: "status", Value: models.PaymentStatusSuccess},
			{Path: "completedAt", Value: now},
			{Path: "transactionFees", Value: info.Fees},
			{Path: "duplicate", Value: duplicate},
			{Path: "orphanedUserIds", Value: orphans},
			{Path: "uncoveredUserIds", Value: uncovered},
		}
		if info.TxnID != "" {
			upd = append(upd, firestore.Update{Path: "easebuzzTxnId", Value: info.TxnID})
		}
		if info.NetAmountDebit != "" {
			upd = append(upd, firestore.Update{Path: "netAmountDebit", Value: info.NetAmountDebit})
		}
		if info.AdminID != "" {
			upd = append(upd,
				firestore.Update{Path: "overriddenBy", Value: info.AdminID},
				firestore.Update{Path: "overriddenAt", Value: now})
		}
		if err := tx.Update(payRef, upd); err != nil {
			return err
		}

		for i := range regSnaps {
			if !settleRegs[i] {
				continue
			}
			if err := tx.Update(regRefs[i], []firestore.Update{
				{Path: "paymentStatus", Value: models.RegPaymentSuccess},
				{Path: "paidAt", Value: now},
			}); err != nil {
				return err
			}
		}

		if markTeamPaid {
			if err := tx.Update(teamRef, []firestore.Update{{Path: "paid", Value: true}}); err != nil {
				return err
			}
		}

		if user != nil && !slices.Contains(user.AccommodationTransactionIds, id) {
			acc, food := user.Accommodation, user.Food
			if acc == nil {
				acc = map[string]bool{}
			}
			if food == nil {
				food = map[string]bool{}
			}
			needed := user.AccommodationNeeded
			for day, v := range p.ProcessedIntentions.Accommodation {
				if on, _ := v.(bool); on {
					acc[day], needed = true, true
				}
			}
			for day, v := range p.ProcessedIntentions.Food {
				if on, _ := v.(bool); on {
					food[day] = true
				}
			}
			if err := tx.Update(userRef, []firestore.Update{
				{Path: "accommodationNeeded", Value: needed},
				{Path: "accommodation", Value: acc},
				{Path: "food", Value: food},
				{Path: "accommodationTransactionIds", Value: append(slices.Clone(user.AccommodationTransactionIds), id)},
				{Path: "updatedAt", Value: now},
			}); err != nil {
				return err
			}
		}

		if p.CouponCode != "" {
			// The document ID is the payment ID, so usage can only be recorded once.
			usage := &models.CouponUsage{
				ID:             id,
				Amount:         p.OriginalAmount,
				CouponCode:     p.CouponCode,
				DiscountAmount: p.DiscountAmount,
				EventID:        p.EventID,
				UsedAt:         now,
				UserID:         p.UserID,
			}
			if err := tx.Create(s.FS.Collection(ColCouponUsage).Doc(id), usage); err != nil {
				return err
			}
		}

		if ownsCheckout {
			return tx.Delete(coRef)
		}
		return nil
	})
	return alreadySettled, wrap(err)
}

// MarkPaymentFailed records a failed attempt and frees the checkout. It never
// overwrites a successful payment, so a late or replayed failure notice is
// harmless. A failed payment can still be settled later if a success notice
// arrives for it.
func (s *Store) MarkPaymentFailed(ctx context.Context, id, txnID, adminID string) error {
	payRef := s.FS.Collection(ColPayments).Doc(id)

	return wrap(s.FS.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		psnap, err := tx.Get(payRef)
		if err != nil {
			return err
		}
		var p models.Payment
		if err := psnap.DataTo(&p); err != nil {
			return err
		}
		if p.Status == models.PaymentStatusSuccess && adminID == "" {
			return nil
		}

		var coRef *firestore.DocumentRef
		ownsCheckout := false
		if p.CheckoutID != "" {
			coRef = s.FS.Collection(ColCheckouts).Doc(p.CheckoutID)
			if cs, err := tx.Get(coRef); err == nil {
				pid, _ := cs.DataAt("paymentId")
				ownsCheckout = pid == id
			} else if !errors.Is(wrap(err), ErrNotFound) {
				return err
			}
		}

		now := isotime.Now()
		upd := []firestore.Update{
			{Path: "status", Value: models.PaymentStatusFailure},
			{Path: "completedAt", Value: now},
		}
		if txnID != "" {
			upd = append(upd, firestore.Update{Path: "easebuzzTxnId", Value: txnID})
		}
		if adminID != "" {
			upd = append(upd,
				firestore.Update{Path: "overriddenBy", Value: adminID},
				firestore.Update{Path: "overriddenAt", Value: now})
		}
		if err := tx.Update(payRef, upd); err != nil {
			return err
		}
		if ownsCheckout {
			return tx.Delete(coRef)
		}
		return nil
	}))
}

var (
	paymentsMu        sync.RWMutex
	paymentsCache     []*models.Payment
	paymentsCacheTime time.Time
	paymentsTTL       = 30 * time.Second
)

// InvalidatePaymentsCache clears the cached payments slice.
func (s *Store) InvalidatePaymentsCache() {
	paymentsMu.Lock()
	paymentsCache = nil
	paymentsMu.Unlock()
}

// ListAllPayments returns every payment, newest first, cached with a 30-second TTL.
func (s *Store) ListAllPayments(ctx context.Context) ([]*models.Payment, error) {
	paymentsMu.RLock()
	if paymentsCache != nil && time.Since(paymentsCacheTime) < paymentsTTL {
		cached := paymentsCache
		paymentsMu.RUnlock()
		return cached, nil
	}
	paymentsMu.RUnlock()

	paymentsMu.Lock()
	defer paymentsMu.Unlock()

	if paymentsCache != nil && time.Since(paymentsCacheTime) < paymentsTTL {
		return paymentsCache, nil
	}

	iter := s.FS.Collection(ColPayments).OrderBy("createdAt", firestore.Desc).Documents(ctx)
	defer iter.Stop()

	payments := []*models.Payment{}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, wrap(err)
		}
		var p models.Payment
		if err := doc.DataTo(&p); err != nil {
			return nil, err
		}
		p.ID = doc.Ref.ID
		payments = append(payments, &p)
	}

	paymentsCache = payments
	paymentsCacheTime = time.Now()
	return payments, nil
}

// ListPayments returns paginated payments and the total count.
func (s *Store) ListPayments(ctx context.Context, limit, offset int) ([]*models.Payment, int, error) {
	all, err := s.ListAllPayments(ctx)
	if err != nil {
		return nil, 0, err
	}
	total := len(all)
	if offset >= total {
		return []*models.Payment{}, total, nil
	}
	end := offset + limit
	if limit <= 0 || end > total {
		end = total
	}
	return all[offset:end], total, nil
}

