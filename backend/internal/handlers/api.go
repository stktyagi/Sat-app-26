package handlers

import (
	"log"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/chatbot"
	"backend/internal/cloudinary"
	"backend/internal/config"
	"backend/internal/fb"
	"backend/internal/models"
	"backend/internal/qr"
	"backend/internal/storage"
	"backend/internal/store"
)

// API carries the dependencies every handler needs.
type API struct {
	Store      *store.Store
	Cache      *store.EventCache
	Faqs       *store.ListCache[*models.Faq]
	Venues     *store.ListCache[*models.Venue]
	Banners    *store.ListCache[*models.Banner]
	Reels      *store.ListCache[*models.Reel]
	Stories    *store.ListCache[*models.Story]
	StoreItems *store.ListCache[*models.StoreItem]
	QR         *qr.Signer
	Cfg        *config.Config
	Chatbot    *chatbot.Service
	Clients    *fb.Clients
	Storage    *storage.Store
	Cloudinary *cloudinary.Client
}

func New(
	s *store.Store,
	cache *store.EventCache,
	faqs *store.ListCache[*models.Faq],
	venues *store.ListCache[*models.Venue],
	banners *store.ListCache[*models.Banner],
	reels *store.ListCache[*models.Reel],
	stories *store.ListCache[*models.Story],
	storeItems *store.ListCache[*models.StoreItem],
	signer *qr.Signer,
	cfg *config.Config,
	cb *chatbot.Service,
	clients *fb.Clients,
	stg *storage.Store,
	cld *cloudinary.Client,
) *API {
	return &API{
		Store:      s,
		Cache:      cache,
		Faqs:       faqs,
		Venues:     venues,
		Banners:    banners,
		Reels:      reels,
		Stories:    stories,
		StoreItems: storeItems,
		QR:         signer,
		Cfg:        cfg,
		Chatbot:    cb,
		Clients:    clients,
		Storage:    stg,
		Cloudinary: cld,
	}
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
