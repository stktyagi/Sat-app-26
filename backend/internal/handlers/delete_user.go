package handlers

import (
	"context"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"backend/internal/middleware"
	"backend/internal/models"
)

func (a *API) DeleteSelf(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// 1. Delete identity files (profile photo and college ID) from ImageKit storage
	a.dropIdentityFiles(c.Request.Context(), user)

	// 2. Delete user and associated registrations from database
	if err := a.Store.DeleteUser(c.Request.Context(), user.UserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete user",
		})
		return
	}

	// 3. Delete user from Firebase Auth
	if a.Clients != nil {
		_ = a.Clients.DeleteUserFromAuth(c.Request.Context(), user.UserID)
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}

// dropIdentityFiles deletes a removed account's face photo and college ID from
// storage synchronously.
func (a *API) dropIdentityFiles(ctx context.Context, u *models.User) {
	if a.Storage == nil || u == nil {
		return
	}
	refs := []string{u.PhotoRef, u.CollegeIDRef}
	for _, ref := range refs {
		if ref == "" {
			continue
		}
		if err := a.Storage.Delete(ctx, ref); err != nil {
			log.Printf("dropIdentityFiles: failed to delete identity file %q for user %s: %v", ref, u.UserID, err)
		} else {
			log.Printf("dropIdentityFiles: successfully deleted identity file %q for user %s", ref, u.UserID)
		}
	}
}
