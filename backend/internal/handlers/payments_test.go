package handlers

import (
	"context"
	"crypto/sha512"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/cache"
	"backend/internal/config"
	"backend/internal/isotime"
	"backend/internal/models"
	"backend/internal/store"
)

func sha(plain string) string { return fmt.Sprintf("%x", sha512.Sum512([]byte(plain))) }

// The pipe counts are the whole point: Easebuzz hashes udf1..udf10 even when
// they are empty, which leaves eleven separators on each side.
func TestEasebuzzHashSequences(t *testing.T) {
	fwd := easebuzzHash("KEY", "TXN", "100.00", "Event", "Ann", "a@b.c", "SALT")
	want := sha("KEY|TXN|100.00|Event|Ann|a@b.c|||||||||||SALT")
	if fwd != want {
		t.Errorf("forward hash does not follow key|txnid|amount|productinfo|firstname|email|udf1..udf10|salt")
	}

	rev := sha("SALT|success|||||||||||a@b.c|Ann|Event|100.00|TXN|KEY")
	if !verifyEasebuzzHash(rev, "SALT", "success", "TXN", "100.00", "Event", "Ann", "a@b.c", "KEY") {
		t.Error("a correct reverse hash should verify")
	}
	if !verifyEasebuzzHash(strings.ToUpper(rev), "SALT", "success", "TXN", "100.00", "Event", "Ann", "a@b.c", "KEY") {
		t.Error("hash comparison should ignore case")
	}
	if verifyEasebuzzHash(rev, "SALT", "failure", "TXN", "100.00", "Event", "Ann", "a@b.c", "KEY") {
		t.Error("a hash must not verify for a different status")
	}
	if verifyEasebuzzHash("", "SALT", "success", "TXN", "100.00", "Event", "Ann", "a@b.c", "KEY") {
		t.Error("an empty hash must never verify")
	}
}

func callback(t *testing.T, a *API, form url.Values) int {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/payments/callback", strings.NewReader(form.Encode()))
	c.Request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	a.PaymentCallback(c)
	return c.Writer.Status()
}

// These return before the store is touched, so the API needs no database.
func TestCallbackRejectsUnverifiedRequests(t *testing.T) {
	forged := url.Values{"txnid": {"SAT25-X"}, "status": {"success"}, "amount": {"100.00"}}

	noSalt := &API{Cfg: &config.Config{}}
	if got := callback(t, noSalt, forged); got != http.StatusServiceUnavailable {
		t.Errorf("no salt configured: want 503, got %d", got)
	}

	a := &API{Cfg: &config.Config{EasebuzzSalt: "SALT", EasebuzzKey: "KEY"}}
	if got := callback(t, a, forged); got != http.StatusBadRequest {
		t.Errorf("missing hash: want 400, got %d", got)
	}
	forged.Set("hash", "deadbeef")
	if got := callback(t, a, forged); got != http.StatusBadRequest {
		t.Errorf("wrong hash: want 400, got %d", got)
	}
}

func TestRedirectPageEscapesOrderID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	a := &API{Cfg: &config.Config{FrontendDeepLinkBase: "saturnalia://payment"}}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	a.redirectToApp(c, `"><script>alert(1)</script>`, "error")

	body := w.Body.String()
	if strings.Contains(body, "<script") || strings.Contains(body, "alert(1)") {
		t.Errorf("order id was not escaped:\n%s", body)
	}
}

func TestCheckCouponRules(t *testing.T) {
	a := &API{} // none of these rules reach the store (no usage limits set)
	host := &models.User{IsHostCollegeStudent: true}
	other := &models.User{}
	day := 24 * time.Hour
	ok := func() *models.Coupon {
		return &models.Coupon{Code: "C", IsActive: true, IsHostCollegeAllowed: true, IsOtherCollegeAllowed: true}
	}

	cases := []struct {
		name   string
		mutate func(*models.Coupon)
		user   *models.User
		cart   int
		code   string // "" means valid
	}{
		{"valid", func(*models.Coupon) {}, host, 100, ""},
		{"inactive", func(c *models.Coupon) { c.IsActive = false }, host, 100, "inactive_coupon"},
		{"expired", func(c *models.Coupon) { c.ValidUntil = isotime.Format(time.Now().Add(-day)) }, host, 100, "coupon_expired"},
		{"not started", func(c *models.Coupon) { c.ValidFrom = isotime.Format(time.Now().Add(day)) }, host, 100, "coupon_not_started"},
		{"below min cart", func(c *models.Coupon) { c.MinCartValue = 500 }, host, 100, "min_cart_value"},
		{"host not allowed", func(c *models.Coupon) { c.IsHostCollegeAllowed = false }, host, 100, "college_not_allowed"},
		{"other not allowed", func(c *models.Coupon) { c.IsOtherCollegeAllowed = false }, other, 100, "college_not_allowed"},
	}
	for _, tc := range cases {
		coupon := ok()
		tc.mutate(coupon)
		err := a.checkCoupon(t.Context(), coupon, tc.user, tc.cart)
		switch {
		case tc.code == "" && err != nil:
			t.Errorf("%s: want valid, got %v", tc.name, err)
		case tc.code != "" && (err == nil || err.Code != tc.code):
			t.Errorf("%s: want %s, got %v", tc.name, tc.code, err)
		}
	}
}

func TestAmountMatches(t *testing.T) {
	for _, tc := range []struct {
		got  string
		want int
		ok   bool
	}{
		{"400.00", 400, true}, {"400", 400, true}, {"1.00", 400, false}, {"401.00", 400, false}, {"", 400, false}, {"abc", 400, false},
	} {
		if got := amountMatches(tc.got, tc.want); got != tc.ok {
			t.Errorf("amountMatches(%q, %d) = %v, want %v", tc.got, tc.want, got, tc.ok)
		}
	}
}

func TestCouponDatesFailClosed(t *testing.T) {
	a := &API{}
	user := &models.User{IsHostCollegeStudent: true}
	mk := func(from, until string) *models.Coupon {
		return &models.Coupon{Code: "C", IsActive: true, IsHostCollegeAllowed: true, IsOtherCollegeAllowed: true, ValidFrom: from, ValidUntil: until}
	}
	yesterday := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
	today := time.Now().UTC().Format("2006-01-02")

	if err := a.checkCoupon(t.Context(), mk("", yesterday), user, 100); err == nil || err.Code != "coupon_expired" {
		t.Errorf("a date-only validUntil in the past must expire the coupon, got %v", err)
	}
	if err := a.checkCoupon(t.Context(), mk("", today), user, 100); err != nil {
		t.Errorf("a date-only validUntil of today runs to the end of the day, got %v", err)
	}
	if err := a.checkCoupon(t.Context(), mk("", "next friday"), user, 100); err == nil || err.Code != "coupon_invalid" {
		t.Errorf("an unparseable date must reject the coupon, got %v", err)
	}
}

func TestStayCharge(t *testing.T) {
	days, fee, bad := stayCharge(map[string]bool{"day1": true, "day2": true, "day3": false}, map[string]bool{"day2": true}, map[string]int{"day1": 300, "day2": 300})
	if bad != "" || fee != 300 || len(days) != 1 || days["day1"] != true {
		t.Errorf("only unowned, selected days are charged: days=%v fee=%d bad=%q", days, fee, bad)
	}
	if _, _, bad := stayCharge(map[string]bool{"day99": true}, nil, nil); bad != "day99" {
		t.Errorf("an unknown day must be rejected, got %q", bad)
	}
}

func TestEasebuzzInitiateParsingAndCleaning(t *testing.T) {
	key := strings.Repeat("ab", 32)
	if got, err := parseEasebuzzInitiate([]byte(`{"status":1,"data":"` + key + `"}`)); err != nil || got != key {
		t.Errorf("success reply: got %q, %v", got, err)
	}
	for _, bad := range []string{`{"status":0,"error_desc":"x","data":"Parameter validation failed"}`, key, `{"status":1,"data":"../x"}`} {
		if _, err := parseEasebuzzInitiate([]byte(bad)); err == nil {
			t.Errorf("accepted %s", bad)
		}
	}
	if got := ebClean("Robo Wars: 2.0 & Hack@Sat!", ebProductInfoBad, 45, "Payment"); got != "Robo Wars 2 0 Hack Sat" {
		t.Errorf("productinfo: %q", got)
	}
	if got := ebClean("यश", ebFirstnameBad, 150, "Participant"); got != "Participant" {
		t.Errorf("firstname fallback: %q", got)
	}
}

func TestPickRetrieveEntry(t *testing.T) {
	two := `{"status":true,"msg":[{"txnid":"T1","status":"userCancelled"},{"txnid":"T1","status":"success","amount":"100.0"}]}`
	if e := pickRetrieveEntry([]byte(two)); e == nil || e["status"] != "success" {
		t.Errorf("want the successful attempt, got %v", e)
	}
	one := `{"status":true,"msg":[{"txnid":"T1","status":"failure"}]}`
	if e := pickRetrieveEntry([]byte(one)); e == nil || e["status"] != "failure" {
		t.Errorf("want the only attempt, got %v", e)
	}
	for _, none := range []string{`{"status":false,"msg":"Transaction not found"}`, `{"status":true,"msg":[]}`, `oops`} {
		if e := pickRetrieveEntry([]byte(none)); e != nil {
			t.Errorf("%s: want nil, got %v", none, e)
		}
	}
}

type stubEventSource struct {
	events map[string]*models.Event
}

func (s *stubEventSource) AllEvents(ctx context.Context) ([]*models.Event, error) {
	out := make([]*models.Event, 0, len(s.events))
	for _, e := range s.events {
		out = append(out, e)
	}
	return out, nil
}

func (s *stubEventSource) CountAllRegistrations(ctx context.Context, eventIDs []string) (map[string]int, error) {
	return map[string]int{}, nil
}

func (s *stubEventSource) GetEvent(ctx context.Context, id string) (*models.Event, error) {
	if e, ok := s.events[id]; ok {
		return e, nil
	}
	return nil, nil
}

func (s *stubEventSource) CountRegistrations(ctx context.Context, eventID string) (int, error) {
	return 0, nil
}

func TestResolveStayPrices(t *testing.T) {
	ctx := context.Background()

	// 1. Without cache or store, fallback defaults must apply
	apiNil := &API{}
	acc, food := apiNil.resolveStayPrices(ctx, nil, "")
	if acc["day1"] != AccommodationPricePerDay || food["day1"] != FoodPricePerDay || len(acc) != len(stayDays) {
		t.Errorf("default fallback price mismatch: acc=%v, food=%v", acc, food)
	}

	// 2. With event cache
	techEv := &models.Event{ID: "tech-1", EventID: "tech-1", Category: "Technical"}
	cultEv := &models.Event{ID: "cult-1", EventID: "cult-1", Category: "Cultural"}
	src := &stubEventSource{events: map[string]*models.Event{
		"tech-1": techEv,
		"cult-1": cultEv,
	}}
	mem := cache.NewMemory()
	ec := store.NewEventCache(src, mem, mem, time.Minute)

	apiWithCache := &API{Cache: ec}

	// User registered for tech event
	accTech, foodTech := apiWithCache.resolveStayPrices(ctx, nil, "tech-1")
	if accTech["day2"] != AccommodationPricePerDay || foodTech["day2"] != FoodPricePerDay {
		t.Errorf("tech event stay prices: acc=%v, food=%v", accTech, foodTech)
	}

	// User registered for cult event
	accCult, foodCult := apiWithCache.resolveStayPrices(ctx, nil, "cult-1")
	if accCult["day3"] != AccommodationPricePerDay || foodCult["day3"] != FoodPricePerDay {
		t.Errorf("cultural event stay prices: acc=%v, food=%v", accCult, foodCult)
	}
}

func TestStayChargeFullScenarios(t *testing.T) {
	foodPrice := map[string]int{"day2": 150, "day3": 150}
	accPrice := map[string]int{"day1": 650, "day2": 650}

	// User owns day1 for accommodation and day2 for food
	userAcc := map[string]bool{"day1": true}
	userFood := map[string]bool{"day2": true}

	// User wants day1, day2 accommodation and day2, day3 food
	reqAcc := map[string]bool{"day1": true, "day2": true}
	reqFood := map[string]bool{"day2": true, "day3": true}

	accDays, accFee, badAcc := stayCharge(reqAcc, userAcc, accPrice)
	if badAcc != "" {
		t.Fatalf("unexpected bad acc day: %s", badAcc)
	}
	// day1 is already owned, only day2 charged
	if accFee != 650 || len(accDays) != 1 || accDays["day2"] != true {
		t.Errorf("accCharge mismatch: fee=%d, days=%v", accFee, accDays)
	}

	foodDays, foodFee, badFood := stayCharge(reqFood, userFood, foodPrice)
	if badFood != "" {
		t.Fatalf("unexpected bad food day: %s", badFood)
	}
	// day2 is already owned, only day3 charged
	if foodFee != 150 || len(foodDays) != 1 || foodDays["day3"] != true {
		t.Errorf("foodCharge mismatch: fee=%d, days=%v", foodFee, foodDays)
	}

	total := accFee + foodFee
	if total != 800 {
		t.Errorf("total stay fee mismatch: expected 800, got %d", total)
	}
}


func TestStayPricesPerDay(t *testing.T) {
	doc := &models.AppAccommodation{
		Amount:            600,
		TechnicalAmount:   650,
		CulturalAmount:    700,
		FoodAmount:        150,
		TechnicalDays:     map[string]int{"day1": 900},
		CulturalDays:      map[string]int{"day1": 800, "day2": 500},
		TechnicalFoodDays: map[string]int{"day0": 100},
	}

	acc, food := stayPrices(doc, true, false)
	if acc["day1"] != 900 || acc["day2"] != 650 || food["day0"] != 100 || food["day1"] != 150 {
		t.Errorf("technical: acc=%v food=%v", acc, food)
	}

	acc, _ = stayPrices(doc, false, true)
	if acc["day1"] != 800 || acc["day2"] != 500 || acc["day3"] != 700 {
		t.Errorf("cultural: acc=%v", acc)
	}

	// Both categories: higher price per day.
	acc, _ = stayPrices(doc, true, true)
	if acc["day1"] != 900 || acc["day2"] != 650 || acc["day3"] != 700 {
		t.Errorf("both: acc=%v", acc)
	}

	// No events: flat amount unless the day has its own price.
	acc, _ = stayPrices(doc, false, false)
	if acc["day3"] != 600 || acc["day1"] != 900 {
		t.Errorf("no events: acc=%v", acc)
	}

	// Charging uses each day's price.
	acc, _ = stayPrices(doc, true, false)
	if _, fee, _ := stayCharge(map[string]bool{"day1": true, "day2": true}, nil, acc); fee != 1550 {
		t.Errorf("per-day fee = %d, want 1550", fee)
	}
}
