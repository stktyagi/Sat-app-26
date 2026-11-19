package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/store"
)

type storeItemBody struct {
	Name        *string  `json:"name"`
	Description *string  `json:"description"`
	Price       *float64 `json:"price"`
	Image       *string  `json:"image"`
	ImageUrl    *string  `json:"imageUrl"`
}

func applyStoreItemBody(item *models.StoreItem, b *storeItemBody) int {
	changed := 0
	if b.Name != nil {
		item.Name = strings.TrimSpace(*b.Name)
		changed++
	}
	if b.Description != nil {
		item.Description = strings.TrimSpace(*b.Description)
		changed++
	}
	if b.Price != nil {
		item.Price = *b.Price
		changed++
	}
	if b.Image != nil {
		item.Image = strings.TrimSpace(*b.Image)
		changed++
	} else if b.ImageUrl != nil {
		item.Image = strings.TrimSpace(*b.ImageUrl)
		changed++
	}
	return changed
}

func validateStoreItem(item *models.StoreItem) error {
	if strings.TrimSpace(item.Name) == "" {
		return apierr.BadRequest("missing_field", "name is required")
	}
	if item.Price < 0 {
		return apierr.BadRequest("invalid_field", "price cannot be negative")
	}
	return nil
}

func respondStoreItemLookup(c *gin.Context, err error) {
	if errors.Is(err, store.ErrNotFound) {
		apierr.Respond(c, apierr.NotFound("store_item_not_found", "no such store item"))
		return
	}
	log.Printf("store item lookup error: %v", err)
	apierr.Respond(c, apierr.Internal("could not load the store item"))
}

// ListStoreItems returns all store items for the public shop.
func (a *API) ListStoreItems(c *gin.Context) {
	items, err := a.StoreItems.All(c.Request.Context())
	if err != nil {
		log.Printf("ListStoreItems error: %v", err)
		c.JSON(http.StatusOK, gin.H{"items": []*models.StoreItem{}, "total": 0})
		return
	}
	if items == nil {
		items = []*models.StoreItem{}
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

// GetLeaderboard returns the top users by coins for the leaderboard screen.
func (a *API) GetLeaderboard(c *gin.Context) {
	limit := 50
	entries, err := a.Store.GetLeaderboard(c.Request.Context(), limit)
	if err != nil {
		log.Printf("GetLeaderboard error: %v", err)
		apierr.Respond(c, apierr.Internal("could not load leaderboard"))
		return
	}

	user := middleware.CurrentUser(c)
	userRank := 0
	userCoins := 0
	if user != nil {
		userCoins = user.Coins
		for _, e := range entries {
			if e.UserID == user.UserID {
				userRank = e.Rank
				break
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"leaderboard": entries,
		"total":       len(entries),
		"userRank":    userRank,
		"userCoins":   userCoins,
	})
}

// GetStoreItem returns details of a single item.
func (a *API) GetStoreItem(c *gin.Context) {
	id := c.Param("id")
	item, err := a.Store.GetStoreItem(c.Request.Context(), id)
	if err != nil {
		respondStoreItemLookup(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"item": item})
}

// AdminListStoreItems returns all store items for the admin panel.
func (a *API) AdminListStoreItems(c *gin.Context) {
	items, err := a.Store.AllStoreItems(c.Request.Context())
	if err != nil {
		log.Printf("AdminListStoreItems error: %v", err)
		apierr.Respond(c, apierr.Internal("could not load store items"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

// AdminGetStoreItem returns an item for editing.
func (a *API) AdminGetStoreItem(c *gin.Context) {
	id := c.Param("id")
	item, err := a.Store.GetStoreItem(c.Request.Context(), id)
	if err != nil {
		respondStoreItemLookup(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"item": item})
}

// CreateStoreItem handles creating a new store item.
func (a *API) CreateStoreItem(c *gin.Context) {
	var body storeItemBody
	if !bind(c, &body) {
		return
	}

	item := &models.StoreItem{}
	applyStoreItemBody(item, &body)
	if err := validateStoreItem(item); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.CreateStoreItem(c.Request.Context(), item); err != nil {
		log.Printf("CreateStoreItem error: %v", err)
		apierr.Respond(c, apierr.Internal("could not create store item"))
		return
	}
	a.StoreItems.Invalidate()

	c.JSON(http.StatusCreated, gin.H{"item": item})
}

// UpdateStoreItem updates existing store item attributes.
func (a *API) UpdateStoreItem(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	item, err := a.Store.GetStoreItem(ctx, id)
	if err != nil {
		respondStoreItemLookup(c, err)
		return
	}

	var body storeItemBody
	if !bind(c, &body) {
		return
	}

	if applyStoreItemBody(item, &body) == 0 {
		apierr.Respond(c, apierr.BadRequest("empty_patch", "no updatable fields supplied"))
		return
	}

	if err := validateStoreItem(item); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.SaveStoreItem(ctx, item); err != nil {
		log.Printf("UpdateStoreItem error: %v", err)
		apierr.Respond(c, apierr.Internal("could not update store item"))
		return
	}
	a.StoreItems.Invalidate()

	c.JSON(http.StatusOK, gin.H{"item": item})
}

// DeleteStoreItem removes a store item.
func (a *API) DeleteStoreItem(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	if _, err := a.Store.GetStoreItem(ctx, id); err != nil {
		respondStoreItemLookup(c, err)
		return
	}

	if err := a.Store.DeleteStoreItem(ctx, id); err != nil {
		log.Printf("DeleteStoreItem error: %v", err)
		apierr.Respond(c, apierr.Internal("could not delete store item"))
		return
	}
	a.StoreItems.Invalidate()

	c.Status(http.StatusNoContent)
}
