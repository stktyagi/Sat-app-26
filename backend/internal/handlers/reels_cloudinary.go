package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/cloudinary"
	"backend/internal/models"
)

// MaxVideoUploadBytes limits video size to 35MB to prevent quota exhaustion.
const MaxVideoUploadBytes = 35 * 1024 * 1024

// CreateReelCloudinary creates a new reel using Cloudinary for storage.
// It accepts multipart/form-data (video and optional thumbnail file) or JSON.
// When no thumbnail is uploaded, it automatically derives a lightweight JPEG
// thumbnail URL directly from the video (so_0,q_auto:eco,w_720), costing 0 extra storage credits.
func (a *API) CreateReelCloudinary(c *gin.Context) {
	if a.Cloudinary == nil || !a.Cloudinary.IsConfigured() {
		apierr.Respond(c, apierr.BadRequest("storage_not_configured", "Cloudinary credentials are not configured"))
		return
	}

	var body reelBody
	contentType := c.ContentType()
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := c.ShouldBind(&body); err != nil {
			apierr.Respond(c, apierr.BadRequest("invalid_form", err.Error()))
			return
		}
	} else {
		if !bind(c, &body) {
			return
		}
	}

	reel := &models.Reel{}
	applyReelBody(reel, &body)

	// Handle video and thumbnail upload to Cloudinary
	if strings.HasPrefix(contentType, "multipart/form-data") {
		// 1. Process Video
		videoHeader, err := c.FormFile("video")
		if errors.Is(err, http.ErrMissingFile) {
			videoHeader, err = c.FormFile("file")
		}
		if err == nil && videoHeader != nil {
			if videoHeader.Size > MaxVideoUploadBytes {
				apierr.Respond(c, apierr.BadRequest("file_too_large", "video file exceeds maximum allowed size of 35MB"))
				return
			}
			file, err := videoHeader.Open()
			if err != nil {
				apierr.Respond(c, apierr.BadRequest("file_read_error", err.Error()))
				return
			}
			defer file.Close()

			res, err := a.Cloudinary.UploadVideo(c.Request.Context(), "sat26/reels", videoHeader.Filename, file)
			if err != nil {
				log.Printf("CreateReelCloudinary: video upload error: %v", err)
				apierr.Respond(c, apierr.Internal("failed to upload video to Cloudinary: "+err.Error()))
				return
			}
			reel.VideoURL = res.SecureURL
			reel.VideoRef = res.PublicID
			if res.Duration > 0 && reel.Duration == 0 {
				reel.Duration = int(res.Duration)
			}
			// Auto-derive thumbnail if none was provided
			if reel.ThumbnailURL == "" {
				reel.ThumbnailURL = cloudinary.GenerateAutoThumbnailURL(res.SecureURL)
			}
		}

		// 2. Process Optional Custom Thumbnail
		thumbHeader, err := c.FormFile("thumbnail")
		if err == nil && thumbHeader != nil {
			file, err := thumbHeader.Open()
			if err != nil {
				apierr.Respond(c, apierr.BadRequest("file_read_error", err.Error()))
				return
			}
			defer file.Close()

			res, err := a.Cloudinary.UploadImage(c.Request.Context(), "sat26/reels/thumbnails", thumbHeader.Filename, file)
			if err != nil {
				log.Printf("CreateReelCloudinary: thumbnail upload error: %v", err)
				apierr.Respond(c, apierr.Internal("failed to upload thumbnail to Cloudinary: "+err.Error()))
				return
			}
			reel.ThumbnailURL = res.SecureURL
			reel.ThumbnailRef = res.PublicID
		}
	}

	// Resolve attached event info if eventId is set
	a.resolveReelEvent(c.Request.Context(), reel)

	if err := validateReel(reel); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.CreateReel(c.Request.Context(), reel); err != nil {
		log.Printf("CreateReelCloudinary: database error: %v", err)
		// Clean up uploaded Cloudinary assets to avoid orphaned files
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if reel.VideoRef != "" {
				_ = a.Cloudinary.DeleteAsset(ctx, reel.VideoRef, "video")
			}
			if reel.ThumbnailRef != "" {
				_ = a.Cloudinary.DeleteAsset(ctx, reel.ThumbnailRef, "image")
			}
		}()
		apierr.Respond(c, apierr.Internal("could not save reel"))
		return
	}

	a.Reels.Invalidate()
	c.JSON(http.StatusCreated, gin.H{"reel": reel})
}

// UpdateReelCloudinary updates an existing reel and manages Cloudinary assets.
// When replacing a video or thumbnail, it immediately deletes the old asset from
// Cloudinary to conserve storage credits.
func (a *API) UpdateReelCloudinary(c *gin.Context) {
	if a.Cloudinary == nil || !a.Cloudinary.IsConfigured() {
		apierr.Respond(c, apierr.BadRequest("storage_not_configured", "Cloudinary credentials are not configured"))
		return
	}

	ctx := c.Request.Context()
	id := c.Param("id")

	reel, err := a.Store.GetReel(ctx, id)
	if err != nil {
		respondReelLookup(c, err)
		return
	}

	oldVideoRef := reel.VideoRef
	oldThumbRef := reel.ThumbnailRef

	var body reelBody
	contentType := c.ContentType()
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := c.ShouldBind(&body); err != nil {
			apierr.Respond(c, apierr.BadRequest("invalid_form", err.Error()))
			return
		}
	} else {
		if !bind(c, &body) {
			return
		}
	}

	n := applyReelBody(reel, &body)

	// Process replacement video if uploaded
	if strings.HasPrefix(contentType, "multipart/form-data") {
		videoHeader, err := c.FormFile("video")
		if errors.Is(err, http.ErrMissingFile) {
			videoHeader, err = c.FormFile("file")
		}
		if err == nil && videoHeader != nil {
			if videoHeader.Size > MaxVideoUploadBytes {
				apierr.Respond(c, apierr.BadRequest("file_too_large", "video file exceeds maximum allowed size of 35MB"))
				return
			}
			file, err := videoHeader.Open()
			if err != nil {
				apierr.Respond(c, apierr.BadRequest("file_read_error", err.Error()))
				return
			}
			defer file.Close()

			res, err := a.Cloudinary.UploadVideo(ctx, "sat26/reels", videoHeader.Filename, file)
			if err != nil {
				log.Printf("UpdateReelCloudinary: video upload error: %v", err)
				apierr.Respond(c, apierr.Internal("failed to upload video to Cloudinary: "+err.Error()))
				return
			}

			// Clean up old video asset on Cloudinary to save storage credits
			if oldVideoRef != "" && oldVideoRef != res.PublicID {
				go func(pid string) {
					delCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
					defer cancel()
					_ = a.Cloudinary.DeleteAsset(delCtx, pid, "video")
				}(oldVideoRef)
			}

			reel.VideoURL = res.SecureURL
			reel.VideoRef = res.PublicID
			if res.Duration > 0 {
				reel.Duration = int(res.Duration)
			}
			// Update auto-thumbnail if thumbnail was previously auto-derived or empty
			if reel.ThumbnailRef == "" {
				reel.ThumbnailURL = cloudinary.GenerateAutoThumbnailURL(res.SecureURL)
			}
			n++
		}

		// Process replacement thumbnail if uploaded
		thumbHeader, err := c.FormFile("thumbnail")
		if err == nil && thumbHeader != nil {
			file, err := thumbHeader.Open()
			if err != nil {
				apierr.Respond(c, apierr.BadRequest("file_read_error", err.Error()))
				return
			}
			defer file.Close()

			res, err := a.Cloudinary.UploadImage(ctx, "sat26/reels/thumbnails", thumbHeader.Filename, file)
			if err != nil {
				log.Printf("UpdateReelCloudinary: thumbnail upload error: %v", err)
				apierr.Respond(c, apierr.Internal("failed to upload thumbnail to Cloudinary: "+err.Error()))
				return
			}

			// Clean up old thumbnail asset on Cloudinary
			if oldThumbRef != "" && oldThumbRef != res.PublicID {
				go func(pid string) {
					delCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
					defer cancel()
					_ = a.Cloudinary.DeleteAsset(delCtx, pid, "image")
				}(oldThumbRef)
			}

			reel.ThumbnailURL = res.SecureURL
			reel.ThumbnailRef = res.PublicID
			n++
		}
	}

	if n == 0 {
		apierr.Respond(c, apierr.BadRequest("empty_patch", "no updatable fields supplied"))
		return
	}

	if body.EventID != nil {
		a.resolveReelEvent(ctx, reel)
	}

	if err := validateReel(reel); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.SaveReel(ctx, reel); err != nil {
		log.Printf("UpdateReelCloudinary: save error: %v", err)
		apierr.Respond(c, apierr.Internal("could not update reel"))
		return
	}

	a.Reels.Invalidate()
	c.JSON(http.StatusOK, gin.H{"reel": reel})
}

// DeleteReelCloudinary removes a reel from Firestore and deletes its assets from Cloudinary.
func (a *API) DeleteReelCloudinary(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	reel, err := a.Store.GetReel(ctx, id)
	if err != nil {
		respondReelLookup(c, err)
		return
	}

	if err := a.Store.DeleteReel(ctx, id); err != nil {
		log.Printf("DeleteReelCloudinary: delete error: %v", err)
		apierr.Respond(c, apierr.Internal("could not delete reel"))
		return
	}
	a.Reels.Invalidate()

	// Destroy Cloudinary assets asynchronously
	if a.Cloudinary != nil && a.Cloudinary.IsConfigured() {
		go func(vRef, tRef string) {
			delCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			if vRef != "" {
				if err := a.Cloudinary.DeleteAsset(delCtx, vRef, "video"); err != nil {
					log.Printf("DeleteReelCloudinary: failed to delete video %q: %v", vRef, err)
				}
			}
			if tRef != "" {
				if err := a.Cloudinary.DeleteAsset(delCtx, tRef, "image"); err != nil {
					log.Printf("DeleteReelCloudinary: failed to delete thumbnail %q: %v", tRef, err)
				}
			}
		}(reel.VideoRef, reel.ThumbnailRef)
	}

	c.Status(http.StatusNoContent)
}

// ListReelsCloudinary returns public reels, including dynamically computed event registration status.
func (a *API) ListReelsCloudinary(c *gin.Context) {
	all, err := a.Reels.All(c.Request.Context())
	if err != nil {
		log.Printf("ListReelsCloudinary error: %v", err)
		apierr.Respond(c, apierr.Internal("could not load reels"))
		return
	}

	now := time.Now().UTC()
	reels := make([]*models.Reel, len(all))
	for i, r := range all {
		copy := *r
		if copy.EventID != "" {
			if ev, err := a.Cache.Get(c.Request.Context(), copy.EventID); err == nil && ev != nil {
				copy.Event = &models.ReelEventInfo{
					ID:                 ev.ID,
					Name:               ev.Title,
					Description:        ev.ShortDescription,
					IsRegistrationOpen: ev.IsRegistrationOpen(now),
				}
			}
		}
		reels[i] = &copy
	}

	c.JSON(http.StatusOK, gin.H{"items": reels})
}
