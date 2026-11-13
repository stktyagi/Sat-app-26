package handlers

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
)

// GetColleges handles GET /colleges (public).
// Returns the full list of colleges, or filters by ?q= if a search query is supplied.
func (a *API) GetColleges(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	ctx := c.Request.Context()

	var list []string
	var err error

	if query == "" {
		// Cache full list for 24h with stale-while-revalidate for 7d
		c.Header("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")
		list, err = a.Store.AllColleges(ctx)
	} else {
		list, err = a.Store.SearchColleges(ctx, query)
	}

	if err != nil {
		log.Printf("[GetColleges] error: %v", err)
		apierr.Respond(c, apierr.Internal("could not fetch colleges"))
		return
	}

	if list == nil {
		list = []string{}
	}

	c.JSON(http.StatusOK, gin.H{
		"colleges": list,
		"total":    len(list),
	})
}
