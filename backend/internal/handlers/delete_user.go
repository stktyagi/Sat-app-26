package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"backend/internal/middleware"
	"backend/internal/models"
)

func (a *API) DeleteSelf(c *gin.Context) {
	user := middleware.CurrentUser(c)

	if err := a.Store.DeleteUser(c.Request.Context(), user.UserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete user",
		})
		return
	}
	a.dropIdentityFiles(user)

	if a.Clients != nil {
		_ = a.Clients.DeleteUserFromAuth(c.Request.Context(), user.UserID)
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}

// dropIdentityFiles deletes a removed account's face photo and college ID from
// storage. Background and best effort, via settleMedia.
func (a *API) dropIdentityFiles(u *models.User) {
	a.settleMedia(true, []string{u.PhotoRef, u.CollegeIDRef}, nil)
}
