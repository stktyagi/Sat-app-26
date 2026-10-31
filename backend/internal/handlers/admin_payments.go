package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/store"
)

// AdminListPayments returns payments with optional pagination.
func (a *API) AdminListPayments(c *gin.Context) {
	ctx := c.Request.Context()

	limit, offset := page(c)
	if limit > 0 {
		payments, total, err := a.Store.ListPayments(ctx, limit, offset)
		if err != nil {
			apierr.Respond(c, apierr.Internal("could not load payments"))
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": payments, "total": total, "limit": limit, "offset": offset})
		return
	}

	payments, err := a.Store.ListAllPayments(ctx)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load payments"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": payments, "total": len(payments)})
}

// AdminUpdatePaymentStatus lets an admin force a payment to success or failure.
// It goes through the same settlement path as the gateway callback, so a forced
// success confirms the registrations, accommodation and coupon exactly as a real
// one would. Reversing a payment that already succeeded is a refund and is not
// supported here.
func (a *API) AdminUpdatePaymentStatus(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id") // MerchantOrderID
	admin := middleware.CurrentUser(c)

	var body struct {
		Status string `json:"status"` // "success" or "failure" ("failed" is accepted for the admin app)
	}
	if !bind(c, &body) {
		return
	}
	if body.Status == "failed" {
		body.Status = models.PaymentStatusFailure
	}
	if body.Status != models.PaymentStatusSuccess && body.Status != models.PaymentStatusFailure {
		apierr.Respond(c, apierr.BadRequest("invalid_status", `status must be "success" or "failure"`))
		return
	}

	payment, err := a.Store.GetPayment(ctx, id)
	if err != nil {
		apierr.Respond(c, apierr.NotFound("payment_not_found", "payment not found"))
		return
	}

	if body.Status == models.PaymentStatusSuccess {
		already, err := a.Store.SettlePayment(ctx, payment.ID, store.SettleInfo{AdminID: admin.UserID})
		if err != nil {
			apierr.Respond(c, apierr.Internal("could not settle payment"))
			return
		}
		if !already {
			a.Cache.Invalidate()
		}
		a.Store.InvalidatePaymentsCache()
		c.JSON(http.StatusOK, gin.H{"message": "payment updated successfully"})
		return
	}

	if err := a.Store.MarkPaymentFailed(ctx, payment.ID, "", admin.UserID); err != nil && !errors.Is(err, store.ErrNotFound) {
		apierr.Respond(c, apierr.Internal("could not update payment status"))
		return
	}
	a.Cache.Invalidate()
	a.Store.InvalidatePaymentsCache()
	c.JSON(http.StatusOK, gin.H{"message": "payment updated successfully"})
}

