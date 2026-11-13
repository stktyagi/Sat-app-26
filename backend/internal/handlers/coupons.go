package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
)

type validateCouponBody struct {
	CouponCode string `json:"couponCode"`
	EventID    string `json:"eventId"`
}

// checkCoupon holds every rule a coupon must pass. Both the validate endpoint
// and payment initiation call it, so a client cannot skip a rule by skipping
// the validate call.
//
// ponytail: usage limits are read before the payment settles, so parallel
// checkouts can overshoot a limit by a few. Count inside SettlePayment's
// transaction if exact limits ever matter.
func (a *API) checkCoupon(ctx context.Context, coupon *models.Coupon, user *models.User, cartValue int) *apierr.Error {
	if !coupon.IsActive {
		return apierr.BadRequest("inactive_coupon", "This coupon is no longer active")
	}

	now := time.Now()
	from, fromOK := couponDate(coupon.ValidFrom, false)
	until, untilOK := couponDate(coupon.ValidUntil, true)
	if (coupon.ValidFrom != "" && !fromOK) || (coupon.ValidUntil != "" && !untilOK) {
		return apierr.BadRequest("coupon_invalid", "This coupon is misconfigured; contact the organisers")
	}
	if fromOK && now.Before(from) {
		return apierr.BadRequest("coupon_not_started", "This coupon is not valid yet")
	}
	if untilOK && now.After(until) {
		return apierr.BadRequest("coupon_expired", "This coupon has expired")
	}

	if !coupon.IsHostCollegeAllowed && user.IsHostCollegeStudent {
		return apierr.Forbidden("college_not_allowed", "This coupon is not valid for host college students")
	}
	if !coupon.IsOtherCollegeAllowed && !user.IsHostCollegeStudent {
		return apierr.Forbidden("college_not_allowed", "This coupon is only valid for host college students")
	}

	if cartValue < coupon.MinCartValue {
		return apierr.BadRequest("min_cart_value", "Your cart is below the minimum value for this coupon")
	}

	if coupon.UsageLimit > 0 {
		globalUsage, err := a.Store.GetCouponUsageCount(ctx, coupon.Code)
		if err != nil {
			return apierr.Internal("could not check coupon usage")
		}
		if globalUsage >= coupon.UsageLimit {
			return apierr.Conflict("coupon_exhausted", "This coupon has reached its maximum usage limit")
		}
	}
	if coupon.UsagePerUserLimit > 0 {
		userUsage, err := a.Store.GetUserCouponUsageCount(ctx, coupon.Code, user.UserID)
		if err != nil {
			return apierr.Internal("could not check coupon usage")
		}
		if userUsage >= coupon.UsagePerUserLimit {
			return apierr.Conflict("coupon_used", "You have reached the maximum usage limit for this coupon")
		}
	}
	return nil
}

// couponDate parses a coupon bound. Besides the stored timestamp format it
// accepts a bare date typed into the console; as an upper bound that date runs
// to the end of the day. An unparseable value is reported so the caller can
// reject the coupon instead of silently skipping its dates.
func couponDate(s string, endOfDay bool) (time.Time, bool) {
	loc, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		return time.Time{}, false
	}

	if t, err := time.ParseInLocation("2006-01-02T15:04", s, loc); err == nil {
		return t, true
	}

	if t, err := time.ParseInLocation("2006-01-02", s, loc); err == nil {
		if endOfDay {
			t = t.Add(24*time.Hour - time.Millisecond)
		}
		return t, true
	}

	return time.Time{}, false
}

func (a *API) ValidateCoupon(c *gin.Context) {
	ctx := c.Request.Context()
	user := middleware.CurrentUser(c)

	var body validateCouponBody
	if !bind(c, &body) {
		return
	}

	coupon, err := a.Store.GetCoupon(ctx, body.CouponCode)
	if err != nil {
		apierr.Respond(c, apierr.NotFound("invalid_coupon", "Coupon not found"))
		return
	}

	// Without an event the cart value is unknown, so minCartValue is only
	// enforced at payment time.
	cartValue := coupon.MinCartValue
	if body.EventID != "" {
		if event, err := a.Cache.Get(ctx, body.EventID); err == nil {
			cartValue = event.FeeFor(user.IsHostCollegeStudent)
		}
	}
	if apiErr := a.checkCoupon(ctx, coupon, user, cartValue); apiErr != nil {
		apierr.Respond(c, apiErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":          coupon.Code,
		"description":   coupon.Description,
		"discountType":  coupon.DiscountType,
		"discountValue": coupon.DiscountValue,
		"minCartValue":  coupon.MinCartValue,
	})
}
