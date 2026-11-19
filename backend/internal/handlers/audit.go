package handlers

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/config"
	"backend/internal/isotime"
	"backend/internal/models"
)

// LogAudit asynchronously writes an audit trail entry with a *models.User target.
func (a *API) LogAudit(action, category string, caller *models.User, target *models.User, details map[string]any) {
	var affected *models.AuditTarget
	if target != nil {
		affected = &models.AuditTarget{
			UserID:      target.UserID,
			Name:        target.DisplayName,
			Email:       target.Email,
			Phone:       target.PhoneNumber,
			CollegeName: target.CollegeName,
		}
		if affected.Name == "" {
			affected.Name = target.Email
		}
	}
	a.LogAuditTarget(action, category, caller, affected, details)
}

// LogAuditTarget asynchronously writes an audit trail entry.
// A background goroutine ensures zero latency impact on API requests.
func (a *API) LogAuditTarget(action, category string, caller *models.User, target *models.AuditTarget, details map[string]any) {
	if a == nil || a.Store == nil {
		return
	}

	var actor models.AuditActor
	if caller != nil {
		actor = models.AuditActor{
			UserID: caller.UserID,
			Name:   caller.DisplayName,
			Email:  caller.Email,
			Roles:  caller.Roles,
		}
		if actor.Name == "" {
			actor.Name = caller.Email
		}
	} else {
		actor = models.AuditActor{
			UserID: "system",
			Name:   "System",
		}
	}

	detCopy := make(map[string]any, len(details))
	for k, v := range details {
		detCopy[k] = v
	}

	now := time.Now()
	nowISO := isotime.Format(now)
	nowIST := now.In(config.IST).Format("02 Jan 2006, 03:04:05 PM IST")

	entry := &models.AuditLog{
		Action:       action,
		Category:     category,
		PerformedBy:  actor,
		AffectedUser: target,
		Details:      detCopy,
		CreatedAt:    nowISO,
		CreatedAtIST: nowIST,
	}

	go func(e *models.AuditLog) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := a.Store.CreateAuditLog(ctx, e); err != nil {
			log.Printf("[audit] error saving audit log (%s/%s): %v", e.Category, e.Action, err)
		}
	}(entry)
}

// AdminListAuditLogs returns recent audit logs for staff inspection.
func (a *API) AdminListAuditLogs(c *gin.Context) {
	limit := 100
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		limit = l
	}
	category := strings.TrimSpace(c.Query("category"))
	action := strings.TrimSpace(c.Query("action"))

	logs, err := a.Store.ListAuditLogs(c.Request.Context(), limit, category, action)
	if err != nil {
		apierr.Respond(c, apierr.Internal("could not load audit logs"))
		return
	}
	if logs == nil {
		logs = []*models.AuditLog{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   len(logs),
		"logs":    logs,
	})
}
