package handlers

import (
	"cmp"
	"context"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/random"
	"backend/internal/store"
)

// ─────────────────────────────────────────────────────────────────────────────
// Easebuzz helpers
// ─────────────────────────────────────────────────────────────────────────────

func (a *API) easebuzzBaseURL() string {
	if a.Cfg.EasebuzzEnv == "prod" {
		return "https://pay.easebuzz.in"
	}
	return "https://testpay.easebuzz.in"
}

// gatewayLive reports whether payments go through Easebuzz rather than the
// dummy checkout.
func (a *API) gatewayLive() bool {
	return !a.Cfg.PaymentsDummy && a.Cfg.EasebuzzKey != "" && a.Cfg.EasebuzzSalt != ""
}

// easebuzzRetrieveURL is the Transaction API, which lives on the dashboard host.
func (a *API) easebuzzRetrieveURL() string {
	if a.Cfg.EasebuzzEnv == "prod" {
		return "https://dashboard.easebuzz.in/transaction/v2.1/retrieve"
	}
	return "https://testdashboard.easebuzz.in/transaction/v2.1/retrieve"
}

// easebuzzInitiateURL is the server-to-server initiation endpoint.
func (a *API) easebuzzInitiateURL() string {
	return a.easebuzzBaseURL() + "/payment/initiateLink"
}

// easebuzzHash builds the SHA-512 request hash Easebuzz expects:
// key|txnid|amount|productinfo|firstname|email|udf1|...|udf10|salt
// All ten udf fields are empty here, which leaves eleven pipes between the
// email and the salt.
func easebuzzHash(key, txnid, amount, productinfo, firstname, email, salt string) string {
	plain := key + "|" + txnid + "|" + amount + "|" + productinfo + "|" + firstname + "|" + email + strings.Repeat("|", 11) + salt
	return fmt.Sprintf("%x", sha512.Sum512([]byte(plain)))
}

// verifyEasebuzzHash checks the reverse hash Easebuzz sends on the callback:
// salt|status|udf10|...|udf1|email|firstname|productinfo|amount|txnid|key
// With empty udfs that is eleven pipes between the status and the email.
func verifyEasebuzzHash(received, salt, status, txnid, amount, productinfo, firstname, email, key string) bool {
	plain := salt + "|" + status + strings.Repeat("|", 11) + email + "|" + firstname + "|" + productinfo + "|" + amount + "|" + txnid + "|" + key
	computed := fmt.Sprintf("%x", sha512.Sum512([]byte(plain)))
	return subtle.ConstantTimeCompare([]byte(computed), []byte(strings.ToLower(received))) == 1
}

// Easebuzz rejects initiate requests whose fields fall outside these patterns
// (taken from its official SDK's validation), so values are cleaned to fit.
var (
	ebProductInfoBad = regexp.MustCompile(`[^a-zA-Z0-9\- |]+`)
	ebFirstnameBad   = regexp.MustCompile(`[^a-zA-Z0-9&'\-._ ()/,@]+`)
	ebNonDigit       = regexp.MustCompile(`\D`)
	ebAccessKey      = regexp.MustCompile(`^[a-f0-9]{64}$`)
)

// ebClean replaces disallowed runs with a space, trims, caps the length and
// falls back to def when nothing usable remains.
func ebClean(s string, bad *regexp.Regexp, maxLen int, def string) string {
	s = strings.Join(strings.Fields(bad.ReplaceAllString(s, " ")), " ")
	if len(s) > maxLen {
		s = strings.TrimSpace(s[:maxLen])
	}
	if s == "" {
		return def
	}
	return s
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/payments/initiate  — called by the app to start a payment
// ─────────────────────────────────────────────────────────────────────────────

type initiatePaymentBody struct {
	EventID       string          `json:"eventId"` // empty for pure accommodation
	TeamID        string          `json:"teamId"`  // empty for individual events
	PaymentType   string          `json:"paymentType"`
	CouponCode    string          `json:"couponCode"`
	Accommodation map[string]bool `json:"accommodation"` // e.g. "day1": true
	Food          map[string]bool `json:"food"`
}

// Default per-day prices in rupees, used when app/accommodation doesn't set one.
const (
	AccommodationPricePerDay = 650
	FoodPricePerDay          = 150
)

// stayDays are the day keys accommodation and food can be bought for; they match
// the keys the app and the hostel check-in screen use.
var stayDays = map[string]bool{"day0": true, "day1": true, "day2": true, "day3": true, "day4": true}

var paymentTypes = map[string]bool{
	models.PaymentTypeEvent:                        true,
	models.PaymentTypeAccommodation:                true,
	models.PaymentTypeAccommodationAndFood:         true,
	models.PaymentTypeEventAndAccommodation:        true,
	models.PaymentTypeEventAndAccommodationAndFood: true,
}

// stayCharge validates the requested days and returns the days actually being
// bought. Days the user already holds are dropped rather than charged again.
func stayCharge(requested map[string]bool, owned map[string]bool, prices map[string]int) (days map[string]any, fee int, bad string) {
	days = map[string]any{}
	for day, selected := range requested {
		if !stayDays[day] {
			return nil, 0, day
		}
		if selected && !owned[day] {
			days[day] = true
			fee += prices[day]
		}
	}
	return days, fee, ""
}

// resolveStayPrices determines the per-day accommodation and food prices based on user's events.
// Any event that is not Technical is treated as Cultural.
func (a *API) resolveStayPrices(ctx context.Context, user *models.User, currentEventID string) (acc, food map[string]int) {
	var accDoc *models.AppAccommodation
	if a.Store != nil {
		if doc, err := a.Store.GetAppAccommodation(ctx); err == nil {
			accDoc = doc
		}
	}

	hasTechnical := false
	hasCultural := false

	checkEvent := func(eid string) {
		if eid == "" || a.Cache == nil {
			return
		}
		ev, err := a.Cache.Get(ctx, eid)
		if err != nil || ev == nil {
			return
		}
		if strings.EqualFold(ev.Category, "Technical") {
			hasTechnical = true
		} else {
			// Events that are not technical are treated as cultural
			hasCultural = true
		}
	}

	if currentEventID != "" {
		checkEvent(currentEventID)
	}

	if user != nil && user.UserID != "" && a.Store != nil {
		regs, err := a.Store.ListUserRegistrations(ctx, user.UserID)
		if err == nil {
			for _, r := range regs {
				checkEvent(r.EventID)
			}
		}
	}

	return stayPrices(accDoc, hasTechnical, hasCultural)
}

// stayPrices prices every stay day from the pricing doc (nil = defaults). If the
// user has both categories the higher price is charged. A day without its own
// price uses the flat category price.
func stayPrices(doc *models.AppAccommodation, hasTechnical, hasCultural bool) (acc, food map[string]int) {
	if doc == nil {
		doc = &models.AppAccommodation{}
	}
	techPrice := cmp.Or(doc.TechnicalAmount, doc.Amount, AccommodationPricePerDay)
	cultPrice := cmp.Or(doc.CulturalAmount, doc.Amount, AccommodationPricePerDay)
	techFoodPrice := cmp.Or(doc.TechnicalFoodAmount, doc.FoodAmount, FoodPricePerDay)
	cultFoodPrice := cmp.Or(doc.CulturalFoodAmount, doc.FoodAmount, FoodPricePerDay)

	// pick applies the category rule to one day. plain is only used when the
	// user has no events and the day has no per-day price.
	pick := func(day string, techDays, cultDays map[string]int, tech, cult, plain int) int {
		t, c := tech, cult
		if techDays[day] > 0 {
			t = techDays[day]
		}
		if cultDays[day] > 0 {
			c = cultDays[day]
		}
		switch {
		case hasTechnical && hasCultural:
			return max(t, c)
		case hasTechnical:
			return t
		case hasCultural:
			return c
		case plain > 0 && techDays[day] <= 0 && cultDays[day] <= 0:
			return plain
		default:
			return max(t, c)
		}
	}

	acc, food = map[string]int{}, map[string]int{}
	for day := range stayDays {
		acc[day] = pick(day, doc.TechnicalDays, doc.CulturalDays, techPrice, cultPrice, doc.Amount)
		food[day] = pick(day, doc.TechnicalFoodDays, doc.CulturalFoodDays, techFoodPrice, cultFoodPrice, doc.FoodAmount)
	}
	return acc, food
}

// InitiatePayment creates a Payment document in Firestore and returns the
// Easebuzz checkout URL that the mobile app should open in a WebView. Calling
// it again with the same cart returns the same payment (see Store.BeginCheckout).
func (a *API) InitiatePayment(c *gin.Context) {
	ctx := c.Request.Context()
	user := middleware.CurrentUser(c)

	var body initiatePaymentBody
	if !bind(c, &body) {
		return
	}

	paymentType := body.PaymentType
	if paymentType == "" {
		paymentType = models.PaymentTypeEvent
		if body.EventID == "" {
			paymentType = models.PaymentTypeAccommodation
		}
	}
	if !paymentTypes[paymentType] {
		apierr.Respond(c, apierr.BadRequest("invalid_payment_type", "unknown paymentType"))
		return
	}

	var event *models.Event
	var team *models.Team
	eventPaymentType := models.EventPaymentTypeIndividual
	covered := []string{}

	if body.EventID != "" {
		var ok bool
		event, ok = a.loadVisibleEvent(c, body.EventID)
		if !ok {
			return
		}

		if !event.PaymentRequired {
			apierr.Respond(c, apierr.BadRequest("no_payment_required", "this event does not require payment"))
			return
		}

		if event.EventType == models.EventTypeTeam {
			eventPaymentType = models.EventPaymentTypeTeam
			if body.TeamID == "" {
				apierr.Respond(c, apierr.BadRequest("missing_team_id", "teamId is required for team events"))
				return
			}
			var err error
			team, err = a.Store.GetTeam(ctx, body.TeamID)
			if err != nil || team.EventID != event.EventID {
				apierr.Respond(c, apierr.NotFound("team_not_found", "team not found"))
				return
			}
			if !team.IsLeader(user.UserID) {
				apierr.Respond(c, apierr.Forbidden("leader_only", "only the team leader can initiate payment"))
				return
			}

			allMembers, err := a.Store.GetUsers(ctx, team.MemberIDs)
			if err != nil {
				apierr.Respond(c, apierr.Internal("could not price the team"))
				return
			}
			totalRosterFee := 0
			if event.IsPerIndividual() {
				for _, mid := range team.MemberIDs {
					m := allMembers[mid]
					isHost := user.IsHostCollegeStudent
					if m != nil {
						m.ResolveHostStatus(a.Cfg.HostEmailDomain)
						isHost = m.IsHostCollegeStudent
					}
					totalRosterFee += event.FeeFor(isHost)
				}
			} else {
				leaderUser := allMembers[team.LeaderUserID]
				isHost := user.IsHostCollegeStudent
				if leaderUser != nil {
					isHost = leaderUser.ResolveHostStatus(a.Cfg.HostEmailDomain).IsHostCollegeStudent
				}
				totalRosterFee = event.FeeFor(isHost)
			}

			remainingDue := max(totalRosterFee-team.PaidTill, 0)
			if remainingDue == 0 && (team.Paid || team.PaidTill > 0) {
				apierr.Respond(c, apierr.Conflict("already_paid", "payment has already been completed for all team members"))
				return
			}
			covered = slices.Clone(team.MemberIDs)
		} else {
			covered = []string{user.UserID}
		}

		// The payer must be registered, and (for individual events) not already paid.
		regID := models.RegistrationID(event.EventID, user.UserID)
		reg, err := a.Store.GetRegistration(ctx, regID)
		if err != nil {
			apierr.Respond(c, apierr.NotFound("not_registered", "you are not registered for this event"))
			return
		}
		if event.EventType != models.EventTypeTeam && reg.PaymentStatus == models.PaymentStatusSuccess {
			apierr.Respond(c, apierr.Conflict("already_paid", "payment has already been completed"))
			return
		}
	}

	// Event fee. A per-individual team event is priced by remaining credit due.
	eventFee := 0
	memberFees := map[string]int{}
	if event != nil {
		eventFee = event.FeeFor(user.IsHostCollegeStudent)
		if team != nil {
			allMembers, _ := a.Store.GetUsers(ctx, team.MemberIDs)
			totalRosterFee := 0
			if event.IsPerIndividual() {
				for _, mid := range team.MemberIDs {
					m := allMembers[mid]
					isHost := user.IsHostCollegeStudent
					if m != nil {
						m.ResolveHostStatus(a.Cfg.HostEmailDomain)
						isHost = m.IsHostCollegeStudent
					}
					f := event.FeeFor(isHost)
					totalRosterFee += f
					memberFees[mid] = f
				}
			} else {
				leaderUser := allMembers[team.LeaderUserID]
				isHost := user.IsHostCollegeStudent
				if leaderUser != nil {
					isHost = leaderUser.ResolveHostStatus(a.Cfg.HostEmailDomain).IsHostCollegeStudent
				}
				totalRosterFee = event.FeeFor(isHost)
			}
			eventFee = max(totalRosterFee-team.PaidTill, 0)
		}
	}

	accPrices, foodPrices := a.resolveStayPrices(c.Request.Context(), user, body.EventID)

	accommodationMap, accFee, bad := stayCharge(body.Accommodation, user.Accommodation, accPrices)
	if bad != "" {
		apierr.Respond(c, apierr.BadRequest("invalid_day", "unknown accommodation day: "+bad))
		return
	}
	foodMap, foodFee, bad := stayCharge(body.Food, user.Food, foodPrices)
	if bad != "" {
		apierr.Respond(c, apierr.BadRequest("invalid_day", "unknown food day: "+bad))
		return
	}

	if accFee > 0 && body.EventID == "" && a.Store != nil {
		regs, err := a.Store.ListUserRegistrations(ctx, user.UserID)
		if err != nil || len(regs) == 0 {
			apierr.Respond(c, apierr.Forbidden("event_registration_required", "you must be registered for at least one event to book accommodation"))
			return
		}
	}

	accDays := map[string]int{}
	for day := range accommodationMap {
		accDays[day] = accPrices[day]
	}
	foodDays := map[string]int{}
	for day := range foodMap {
		foodDays[day] = foodPrices[day]
	}

	a.initiate(c, user, event, team, eventPaymentType, paymentType, body.CouponCode,
		covered, eventFee, memberFees, accommodationMap, accFee, accDays, foodMap, foodFee, foodDays)
}

// easebuzzPayMode returns "production" or "test" for the Easebuzz mobile SDK.
func (a *API) easebuzzPayMode() string {
	if a.Cfg.EasebuzzEnv == "prod" {
		return "production"
	}
	return "test"
}

// initiate prices the cart, applies the coupon and opens the checkout.
func (a *API) initiate(
	c *gin.Context,
	user *models.User,
	event *models.Event,
	team *models.Team,
	eventPaymentType, paymentType, couponCode string,
	covered []string,
	eventFee int,
	memberFees map[string]int,
	accommodationMap map[string]any, accFee int, accDays map[string]int,
	foodMap map[string]any, foodFee int, foodDays map[string]int,
) {
	ctx := c.Request.Context()

	originalAmount := eventFee + accFee + foodFee
	if originalAmount <= 0 {
		apierr.Respond(c, apierr.BadRequest("no_fee", "total fee is zero"))
		return
	}

	discountAmount := 0
	var couponDetails *models.CouponDetails
	if couponCode != "" {
		coupon, err := a.Store.GetCoupon(ctx, couponCode)
		if err != nil {
			apierr.Respond(c, apierr.BadRequest("invalid_coupon", "Coupon not found"))
			return
		}
		if apiErr := a.checkCoupon(ctx, coupon, user, originalAmount); apiErr != nil {
			apierr.Respond(c, apiErr)
			return
		}
		discount := 0.0
		switch coupon.DiscountType {
		case "flat":
			discount = coupon.DiscountValue
		case "percentage":
			discount = float64(originalAmount) * (coupon.DiscountValue / 100.0)
		}
		discountAmount = min(int(discount), originalAmount)
		couponDetails = &models.CouponDetails{
			Code:          coupon.Code,
			DiscountType:  coupon.DiscountType,
			DiscountValue: coupon.DiscountValue,
		}
		couponCode = coupon.Code
	}

	bill := map[string]any{
		"event":         eventFee,
		"accommodation": accFee,
		"food":          foodFee,
		"total":         originalAmount,
	}
	if len(accDays) > 0 {
		bill["accommodation_days"] = accDays
	}
	if len(foodDays) > 0 {
		bill["food_days"] = foodDays
	}
	if len(memberFees) > 0 {
		bill["event_members"] = memberFees
	}
	if team != nil && event != nil && !event.IsPerIndividual() && team.PaidTill > 0 {
		bill["already_paid"] = team.PaidTill
	}
	if discountAmount > 0 {
		bill["discount"] = discountAmount
	}
	bill["final"] = max(originalAmount-discountAmount, 1)

	var evtIntention *models.EventRegistrationIntention
	eventID, teamID, checkoutID := "", "", user.UserID+"_stay"
	if event != nil {
		eventID = event.EventID
		checkoutID = user.UserID + "_" + eventID
		evtIntention = &models.EventRegistrationIntention{
			EventID:        event.EventID,
			EventType:      eventPaymentType,
			Amount:         eventFee,
			CoveredUserIDs: covered,
			PerIndividual:  event.IsPerIndividual(),
		}
		if team != nil {
			teamID = team.TeamID
			checkoutID = team.TeamID
			evtIntention.TeamID = team.TeamID
			evtIntention.TeamName = team.TeamName
		}
	}

	payment := models.NewPayment(
		models.NewPaymentID(random.Code(8)), user.UserID, eventID, teamID,
		paymentType, originalAmount, discountAmount,
		couponCode, couponDetails,
		models.ProcessedIntentions{
			EventRegistration: evtIntention,
			Accommodation:     accommodationMap,
			Food:              foodMap,
		},
		bill,
	)

	payment, checkout, err := a.Store.BeginCheckout(ctx, checkoutID, payment)
	switch {
	case errors.Is(err, store.ErrCheckoutBusy):
		apierr.Respond(c, apierr.Conflict("checkout_in_progress", "a payment for this cart is already being created; retry in a moment"))
		return
	case errors.Is(err, store.ErrRosterChanged):
		apierr.Respond(c, apierr.Conflict("team_changed", "the team's members changed while you were paying; review the team and try again"))
		return
	case errors.Is(err, store.ErrTeamLocked):
		apierr.Respond(c, apierr.Conflict("already_paid", "payment has already been completed"))
		return
	case err != nil:
		apierr.Respond(c, apierr.Internal("could not create payment record"))
		return
	case checkout.PaymentURL != "": // a retried initiate: same cart, same link
		var accessKey string
		prefix := a.easebuzzBaseURL() + "/pay/"
		if strings.HasPrefix(checkout.PaymentURL, prefix) {
			accessKey = strings.TrimPrefix(checkout.PaymentURL, prefix)
		}
		c.JSON(http.StatusOK, gin.H{
			"paymentUrl":      checkout.PaymentURL,
			"merchantOrderId": payment.MerchantOrderID,
			"accessKey":       accessKey,
			"payMode":         a.easebuzzPayMode(),
			"bill":            payment.Bill,
		})
		return
	}

	productInfo := "Payment"
	if event != nil {
		productInfo = event.Title
	}

	link, accessKey, err := a.getEasebuzzLink(ctx, payment.MerchantOrderID, payment.FinalAmount, productInfo, user)
	if err != nil {
		log.Printf("[payment] gateway initiation failed for %s: %v", payment.MerchantOrderID, err)
		if err := a.Store.MarkPaymentFailed(ctx, payment.MerchantOrderID, "", ""); err != nil {
			log.Printf("[payment] could not release checkout %s: %v", checkoutID, err)
		}
		apierr.Respond(c, apierr.Internal("could not initiate payment with gateway"))
		return
	}
	if err := a.Store.SetCheckoutURL(ctx, checkoutID, payment.MerchantOrderID, link); err != nil {
		log.Printf("[payment] could not store checkout link for %s: %v", payment.MerchantOrderID, err)
	}

	c.JSON(http.StatusOK, gin.H{
		"paymentUrl":      link,
		"merchantOrderId": payment.MerchantOrderID,
		"accessKey":       accessKey,
		"payMode":         a.easebuzzPayMode(),
		"bill":            payment.Bill,
	})
}

// getEasebuzzLink calls the Easebuzz initiate API and returns the checkout URL and access key.
func (a *API) getEasebuzzLink(
	_ context.Context,
	merchantOrderID string,
	amount int,
	productInfo string,
	user *models.User,
) (string, string, error) {
	if !a.gatewayLive() {
		return fmt.Sprintf("%s/api/v1/payments/dummy?txnid=%s", a.Cfg.AppBaseURL, url.QueryEscape(merchantOrderID)), "", nil
	}

	amountStr := fmt.Sprintf("%.2f", float64(amount))
	productinfo := ebClean(productInfo, ebProductInfoBad, 45, "Payment")
	firstname := ebClean(user.DisplayName, ebFirstnameBad, 150, "Participant")
	email := user.Email
	phone := ebNonDigit.ReplaceAllString(user.PhoneNumber, "")
	if len(phone) < 10 {
		phone = "9999999999"
	}

	hash := easebuzzHash(a.Cfg.EasebuzzKey, merchantOrderID, amountStr, productinfo, firstname, email, a.Cfg.EasebuzzSalt)

	surl := a.Cfg.AppBaseURL + "/api/v1/payments/callback?status=success"
	furl := a.Cfg.AppBaseURL + "/api/v1/payments/callback?status=failure"

	form := url.Values{}
	form.Set("key", a.Cfg.EasebuzzKey)
	form.Set("txnid", merchantOrderID)
	form.Set("amount", amountStr)
	form.Set("productinfo", productinfo)
	form.Set("firstname", firstname)
	form.Set("email", email)
	form.Set("phone", phone)
	form.Set("surl", surl)
	form.Set("furl", furl)
	form.Set("hash", hash)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.PostForm(a.easebuzzInitiateURL(), form)
	if err != nil {
		return "", "", fmt.Errorf("easebuzz request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	accessKey, err := parseEasebuzzInitiate(body)
	if resp.StatusCode != http.StatusOK || err != nil {
		return "", "", fmt.Errorf("easebuzz returned %d: %v", resp.StatusCode, err)
	}
	return a.easebuzzBaseURL() + "/pay/" + accessKey, accessKey, nil
}

// parseEasebuzzInitiate reads the initiateLink reply, {"status":1,"data":"<access key>"};
// on failure status is 0 and data carries the error.
func parseEasebuzzInitiate(body []byte) (string, error) {
	var r struct {
		Status int `json:"status"`
		Data   any `json:"data"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return "", fmt.Errorf("bad response %q", body)
	}
	key, _ := r.Data.(string)
	if r.Status != 1 || !ebAccessKey.MatchString(key) {
		return "", fmt.Errorf("initiate rejected: %s", body)
	}
	return key, nil
}

// DummyPayment is a mock checkout that settles a payment without a gateway. The
// route only exists when PAYMENTS_DUMMY is on.
func (a *API) DummyPayment(c *gin.Context) {
	txnid := c.Query("txnid")
	if txnid == "" {
		apierr.Respond(c, apierr.BadRequest("missing_txnid", "txnid is required"))
		return
	}
	a.finishPayment(c, txnid, true, store.SettleInfo{TxnID: "dummy"})
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/payments/callback  — Easebuzz redirects here after payment
// Also serves as the webhook endpoint.
// ─────────────────────────────────────────────────────────────────────────────

// PaymentCallback handles both the browser redirect (surl/furl) and the
// server-to-server webhook from Easebuzz. Both carry the same form fields, and
// both can arrive for the same payment, in any order, more than once: the
// outcome is applied by Store.SettlePayment / MarkPaymentFailed, which are
// idempotent.
func (a *API) PaymentCallback(c *gin.Context) {
	if err := c.Request.ParseForm(); err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	f := c.Request.FormValue

	txnid, status, amount := f("txnid"), f("status"), f("amount") // txnid is our merchantOrderId
	if txnid == "" || status == "" {
		c.Status(http.StatusBadRequest)
		return
	}

	// The hash is what proves this came from Easebuzz, so without a salt to
	// check it against nothing can be trusted.
	if a.Cfg.EasebuzzSalt == "" {
		log.Printf("[payment] callback for %s rejected: EASEBUZZ_SALT not configured", txnid)
		c.Status(http.StatusServiceUnavailable)
		return
	}
	if !verifyEasebuzzHash(f("hash"), a.Cfg.EasebuzzSalt, status, txnid, amount, f("productinfo"), f("firstname"), f("email"), a.Cfg.EasebuzzKey) {
		log.Printf("[payment] hash mismatch or missing for txnid=%s", txnid)
		c.Status(http.StatusBadRequest)
		return
	}

	payment, err := a.Store.GetPayment(c.Request.Context(), txnid)
	if errors.Is(err, store.ErrNotFound) {
		a.redirectToApp(c, txnid, "error")
		return
	} else if err != nil {
		log.Printf("[payment] could not load payment %s: %v", txnid, err)
		c.Status(http.StatusInternalServerError)
		return
	}

	// What the gateway says it collected must be what we asked for.
	if !amountMatches(amount, payment.FinalAmount) {
		log.Printf("[payment] amount mismatch for %s: gateway %q, expected %d", txnid, amount, payment.FinalAmount)
		c.Status(http.StatusBadRequest)
		return
	}

	// A storage failure returns 500 so the gateway retries the webhook.
	stored, err := a.applyGatewayStatus(c.Request.Context(), payment, status, f)
	if err != nil {
		log.Printf("[payment] could not apply %q to %s: %v", status, txnid, err)
		c.Status(http.StatusInternalServerError)
		return
	}
	a.redirectToApp(c, txnid, stored)
}

// applyGatewayStatus records a verified Easebuzz outcome and returns the status
// now stored. f reads the gateway's fields. Settling and failing are both
// idempotent, so the redirect, the webhook and reconcilePayment can all report
// the same payment, in any order.
func (a *API) applyGatewayStatus(ctx context.Context, p *models.Payment, status string, f func(string) string) (string, error) {
	switch strings.ToLower(status) {
	case "success":
		fees := 0
		if net, err := strconv.ParseFloat(f("net_amount_debit"), 64); err == nil {
			fees = max(int(math.Round(net-float64(p.FinalAmount))), 0)
		}
		already, err := a.Store.SettlePayment(ctx, p.MerchantOrderID, store.SettleInfo{
			TxnID:          f("easepayid"),
			NetAmountDebit: f("net_amount_debit"),
			Fees:           fees,
		})
		if err != nil {
			return "", err
		}
		if !already {
			a.Cache.Invalidate()
		}
		return models.PaymentStatusSuccess, nil
	case "failure", "failed", "usercancelled", "dropped", "bounced":
		if err := a.Store.MarkPaymentFailed(ctx, p.MerchantOrderID, f("easepayid"), ""); err != nil {
			return "", err
		}
		// MarkPaymentFailed leaves a paid payment alone, so report what is stored.
		if q, err := a.Store.GetPayment(ctx, p.MerchantOrderID); err == nil {
			return q.Status, nil
		}
		return models.PaymentStatusFailure, nil
	default:
		// An in-flight status (pending, initiated, ...) must not fail the
		// payment: a failure unlocks the team and frees the checkout.
		if !strings.EqualFold(status, "pending") {
			log.Printf("[payment] %s: unrecognised gateway status %q, leaving pending", p.MerchantOrderID, status)
		}
		return models.PaymentStatusPending, nil
	}
}

// reconcilePayment asks Easebuzz directly for a pending payment's outcome and
// applies it, so the result never depends on the redirect or webhook reaching
// us (the user closing the browser early, a missed webhook).
func (a *API) reconcilePayment(ctx context.Context, p *models.Payment) (string, error) {
	form := url.Values{}
	form.Set("key", a.Cfg.EasebuzzKey)
	form.Set("txnid", p.MerchantOrderID)
	form.Set("hash", fmt.Sprintf("%x", sha512.Sum512([]byte(a.Cfg.EasebuzzKey+"|"+p.MerchantOrderID+"|"+a.Cfg.EasebuzzSalt))))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.easebuzzRetrieveURL(), strings.NewReader(form.Encode()))
	if err != nil {
		return p.Status, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return p.Status, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	entry := pickRetrieveEntry(body)
	if entry == nil { // not attempted yet, or an error reply: nothing to apply
		return p.Status, nil
	}
	f := func(k string) string {
		if v, ok := entry[k]; ok && v != nil {
			return fmt.Sprint(v)
		}
		return ""
	}
	if f("txnid") != p.MerchantOrderID || !amountMatches(f("amount"), p.FinalAmount) {
		return p.Status, fmt.Errorf("retrieve mismatch: txnid %q amount %q", f("txnid"), f("amount"))
	}
	return a.applyGatewayStatus(ctx, p, f("status"), f)
}

// pickRetrieveEntry reads a Transaction API reply, {"status":true,"msg":[{...}]},
// one entry per attempt. A successful attempt wins; otherwise the first. It
// returns nil when there is no transaction (msg is then an error string).
func pickRetrieveEntry(body []byte) map[string]any {
	var r struct {
		Msg json.RawMessage `json:"msg"`
	}
	if json.Unmarshal(body, &r) != nil {
		return nil
	}
	var entries []map[string]any
	if json.Unmarshal(r.Msg, &entries) != nil {
		var one map[string]any
		if json.Unmarshal(r.Msg, &one) != nil || one == nil {
			return nil
		}
		entries = []map[string]any{one}
	}
	for _, e := range entries {
		if s, _ := e["status"].(string); strings.EqualFold(s, "success") {
			return e
		}
	}
	if len(entries) == 0 {
		return nil
	}
	return entries[0]
}

// amountMatches compares the amount Easebuzz reports with the amount charged.
func amountMatches(got string, want int) bool {
	v, err := strconv.ParseFloat(got, 64)
	return err == nil && math.Abs(v-float64(want)) <= 0.009
}

// finishPayment applies a verified outcome and answers the caller. A storage
// failure returns 500 so the gateway retries the webhook; that is safe because
// both outcomes are idempotent.
func (a *API) finishPayment(c *gin.Context, id string, success bool, info store.SettleInfo) {
	ctx := c.Request.Context()

	if success {
		already, err := a.Store.SettlePayment(ctx, id, info)
		if errors.Is(err, store.ErrNotFound) {
			apierr.Respond(c, apierr.NotFound("payment_not_found", "payment not found"))
			return
		}
		if err != nil {
			log.Printf("[payment] could not settle %s: %v", id, err)
			c.Status(http.StatusInternalServerError)
			return
		}
		if !already {
			a.Cache.Invalidate()
		}
		a.redirectToApp(c, id, models.PaymentStatusSuccess)
		return
	}

	if err := a.Store.MarkPaymentFailed(ctx, id, info.TxnID, info.AdminID); err != nil {
		log.Printf("[payment] could not mark %s failed: %v", id, err)
		c.Status(http.StatusInternalServerError)
		return
	}
	// MarkPaymentFailed leaves a paid payment alone, so report what is stored.
	status := models.PaymentStatusFailure
	if p, err := a.Store.GetPayment(ctx, id); err == nil && p.Status == models.PaymentStatusSuccess {
		status = models.PaymentStatusSuccess
	}
	a.redirectToApp(c, id, status)
}

// redirectToApp sends the user back to the app via a deep-link or a simple
// HTML page that closes the WebView.
func (a *API) redirectToApp(c *gin.Context, merchantOrderID, status string) {
	// Return JSON for webhook (server-to-server) calls; direct HTTP redirect for browser.
	accept := c.GetHeader("Accept")
	if strings.Contains(accept, "application/json") {
		c.JSON(http.StatusOK, gin.H{"status": status, "merchantOrderId": merchantOrderID})
		return
	}

	sep := "?"
	if strings.Contains(a.Cfg.FrontendDeepLinkBase, "?") {
		sep = "&"
	}
	rawDeepLink := a.Cfg.FrontendDeepLinkBase + sep +
		url.Values{"status": {status}, "merchantOrderId": {merchantOrderID}}.Encode()

	c.Header("Cache-Control", "no-store, no-cache, must-revalidate")
	c.Redirect(http.StatusSeeOther, rawDeepLink)
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/payments/:merchantOrderId  — check status (for polling)
// ─────────────────────────────────────────────────────────────────────────────

func (a *API) GetPayment(c *gin.Context) {
	ctx := c.Request.Context()
	user := middleware.CurrentUser(c)

	payment, err := a.Store.GetPayment(ctx, c.Param("merchantOrderId"))
	if err != nil {
		if err == store.ErrNotFound {
			apierr.Respond(c, apierr.NotFound("payment_not_found", "no such payment"))
		} else {
			apierr.Respond(c, apierr.Internal("could not fetch payment"))
		}
		return
	}

	if payment.UserID != user.UserID && !user.IsAdmin() {
		apierr.Respond(c, apierr.Forbidden("not_yours", "this payment belongs to someone else"))
		return
	}

	// The app only trusts this endpoint, so a pending payment is checked with
	// Easebuzz itself rather than waiting on the callback.
	if payment.Status == models.PaymentStatusPending && a.gatewayLive() {
		if _, err := a.reconcilePayment(ctx, payment); err != nil {
			log.Printf("[payment] reconcile %s: %v", payment.MerchantOrderID, err)
		} else if p, err := a.Store.GetPayment(ctx, payment.MerchantOrderID); err == nil {
			payment = p
		}
	}

	c.JSON(http.StatusOK, gin.H{"payment": payment})
}
