package handlers

import (
	"log"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/chatbot"
	"backend/internal/config"
	"backend/internal/fb"
	"backend/internal/qr"
	"backend/internal/store"
)

// API carries the dependencies every handler needs.
type API struct {
	Store   *store.Store
	Cache   *store.EventCache
	QR      *qr.Signer
	Cfg     *config.Config
	Chatbot *chatbot.Service
	Clients *fb.Clients
}

func New(s *store.Store, cache *store.EventCache, signer *qr.Signer, cfg *config.Config, cb *chatbot.Service, clients *fb.Clients) *API {
	return &API{Store: s, Cache: cache, QR: signer, Cfg: cfg, Chatbot: cb, Clients: clients}
}

// bind parses a JSON body and reports a uniform error for malformed input.
func bind(c *gin.Context, dst any) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		log.Printf("[bind] JSON error: %T: %v", err, err)
		apierr.Respond(c, apierr.BadRequest("invalid_body", err.Error()))
		return false
	}
	return true
}