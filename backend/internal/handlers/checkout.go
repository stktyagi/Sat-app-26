package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/store"
)

const checkoutQRPrefix = "checkout:"

// AdminGenerateCheckoutQR returns the signed token to print as a common hostel checkout QR.
func (a *API) AdminGenerateCheckoutQR(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"qr":   a.QR.Sign(checkoutQRPrefix + "all"),
		"type": "checkout",
	})
}

// UserCheckout processes an automated hostel checkout for the authenticated user.
func (a *API) UserCheckout(c *gin.Context) {
	ctx := c.Request.Context()
	u := middleware.CurrentUser(c)
	if u == nil {
		apierr.Respond(c, apierr.Unauthorized("unauthorized", "login required"))
		return
	}

	var req struct {
		Data string `json:"data"`
	}
	if !bind(c, &req) {
		return
	}

	payload, err := a.QR.Verify(strings.TrimSpace(req.Data))
	if err != nil || !strings.HasPrefix(payload, checkoutQRPrefix) {
		apierr.Respond(c, apierr.BadRequest("invalid_qr", "invalid checkout QR code"))
		return
	}

	// User must have an active accommodation or hostel allotment
	if u.CheckInStatus.Hostel == "" && !u.CheckInStatus.Accommodation {
		apierr.Respond(c, apierr.BadRequest("not_checked_in", "you do not have an active hostel check-in"))
		return
	}

	if u.CheckInStatus.CheckedOut {
		c.JSON(http.StatusOK, gin.H{
			"success":    true,
			"message":    "You have already checked out. Please move to the gate.",
			"already":    true,
			"hostel":     u.CheckInStatus.Hostel,
			"roomNo":     u.CheckInStatus.RoomNo,
			"unreturned": u.CheckInStatus.Items.Unreturned(),
		})
		return
	}

	updatedUser, err := a.Store.ApplyHostelAction(ctx, u.UserID, store.HostelActionInput{
		Action: store.HostelActionCheckOut,
	})
	if err != nil {
		respondHostelErr(c, err)
		return
	}

	a.LogAudit("checkout", "hospitality", u, updatedUser, map[string]any{
		"action":     "checkout",
		"method":     "qr",
		"hostel":     updatedUser.CheckInStatus.Hostel,
		"roomNo":     updatedUser.CheckInStatus.RoomNo,
		"unreturned": updatedUser.CheckInStatus.Items.Unreturned(),
	})

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"message":    "Checkout confirmed. Please move to the gate.",
		"hostel":     updatedUser.CheckInStatus.Hostel,
		"roomNo":     updatedUser.CheckInStatus.RoomNo,
		"unreturned": updatedUser.CheckInStatus.Items.Unreturned(),
	})
}
