package handlers

import (
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/models"
	"backend/internal/store"
)

type reelBody struct {
	Title        *string               `json:"title"        form:"title"`
	Description  *string               `json:"description"  form:"description"`
	VideoURL     *string               `json:"videoUrl"     form:"videoUrl"`
	VideoLink    *string               `json:"videoLink"    form:"videoLink"`
	ThumbnailURL *string               `json:"thumbnailUrl" form:"thumbnailUrl"`
	EventID      *string               `json:"eventId"      form:"eventId"`
	Event        *models.ReelEventInfo `json:"event"`
	Duration     *int                  `json:"duration"     form:"duration"`
	Order        *int                  `json:"order"        form:"order"`
}

// ListReels returns all reels for public/user view.
func (a *API) ListReels(c *gin.Context) {
	all, err := a.Reels.All(c.Request.Context())
	if err != nil {
		log.Printf("ListReels error: %v", err)
		apierr.Respond(c, apierr.Internal("could not load reels"))
		return
	}

	// Update isRegistrationOpen dynamically for attached events
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

// GetReel returns a single reel by ID for users.
func (a *API) GetReel(c *gin.Context) {
	r, err := a.Store.GetReel(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondReelLookup(c, err)
		return
	}

	if r.EventID != "" {
		if ev, err := a.Cache.Get(c.Request.Context(), r.EventID); err == nil && ev != nil {
			r.Event = &models.ReelEventInfo{
				ID:                 ev.ID,
				Name:               ev.Title,
				Description:        ev.ShortDescription,
				IsRegistrationOpen: ev.IsRegistrationOpen(time.Now().UTC()),
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"reel": r})
}

// AdminListReels returns all reels for admin management.
func (a *API) AdminListReels(c *gin.Context) {
	all, err := a.Reels.All(c.Request.Context())
	if err != nil {
		log.Printf("AdminListReels error: %v", err)
		apierr.Respond(c, apierr.Internal("could not load reels"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": all})
}

// AdminGetReel returns any reel by ID for admins.
func (a *API) AdminGetReel(c *gin.Context) {
	r, err := a.Store.GetReel(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondReelLookup(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"reel": r})
}

// CreateReel handles creating a reel. Supports multipart video/thumbnail upload
// to AWS S3 or JSON body with videoUrl/videoLink and attached event details.
func (a *API) CreateReel(c *gin.Context) {
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
	saved := false
	defer func() { a.settleMedia(saved, nil, reelRefs(reel)) }()

	// If a video or thumbnail file was uploaded in multipart form, upload to AWS S3
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := a.handleReelFileUploads(c, reel); err != nil {
			apierr.Respond(c, err)
			return
		}
	}

	// Resolve attached event details if eventId is set
	a.resolveReelEvent(c.Request.Context(), reel)

	if err := validateReel(reel); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.CreateReel(c.Request.Context(), reel); err != nil {
		log.Printf("CreateReel error: %v", err)
		apierr.Respond(c, apierr.Internal("could not create reel"))
		return
	}
	saved = true
	a.Reels.Invalidate()

	c.JSON(http.StatusCreated, gin.H{"reel": reel})
}

// UpdateReel applies a partial update to an existing reel.
func (a *API) UpdateReel(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	reel, err := a.Store.GetReel(ctx, id)
	if err != nil {
		respondReelLookup(c, err)
		return
	}
	before := reelRefs(reel)
	saved := false
	defer func() { a.settleMedia(saved, before, reelRefs(reel)) }()

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

	if strings.HasPrefix(contentType, "multipart/form-data") {
		uploadErr := a.handleReelFileUploads(c, reel)
		if uploadErr != nil {
			apierr.Respond(c, uploadErr)
			return
		}
		if !slices.Equal(before, reelRefs(reel)) {
			n++
		}
	}

	if n == 0 {
		apierr.Respond(c, apierr.BadRequest("empty_patch", "no updatable fields supplied"))
		return
	}

	// Re-resolve attached event details if eventId changed
	if body.EventID != nil {
		a.resolveReelEvent(ctx, reel)
	}

	if err := validateReel(reel); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.SaveReel(ctx, reel); err != nil {
		log.Printf("SaveReel error: %v", err)
		apierr.Respond(c, apierr.Internal("could not update reel"))
		return
	}
	saved = true
	a.Reels.Invalidate()

	c.JSON(http.StatusOK, gin.H{"reel": reel})
}

// DeleteReel removes a reel and cleans up its media in S3.
func (a *API) DeleteReel(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	reel, err := a.Store.GetReel(ctx, id)
	if err != nil {
		respondReelLookup(c, err)
		return
	}

	if err := a.Store.DeleteReel(ctx, id); err != nil {
		log.Printf("DeleteReel error: %v", err)
		apierr.Respond(c, apierr.Internal("could not delete reel"))
		return
	}
	a.Reels.Invalidate()

	a.settleMedia(true, reelRefs(reel), nil)

	c.Status(http.StatusNoContent)
}

func (a *API) handleReelFileUploads(c *gin.Context, reel *models.Reel) *apierr.Error {
	// Video file
	videoHeader, err := c.FormFile("video")
	if errors.Is(err, http.ErrMissingFile) {
		videoHeader, err = c.FormFile("file")
	}

	var tmpVideoPath string
	if err == nil && videoHeader != nil {
		if a.S3 == nil || !a.S3.IsConfigured() {
			return apierr.BadRequest("storage_not_configured", "AWS S3 storage is not configured")
		}
		file, err := videoHeader.Open()
		if err != nil {
			return apierr.BadRequest("file_read_error", err.Error())
		}
		defer file.Close()

		// Save uploaded video to temp file for streaming upload and thumbnail extraction
		tmpFile, err := os.CreateTemp("", "reel_upload_*.mp4")
		if err != nil {
			return apierr.Internal("failed to create temporary file for upload")
		}
		tmpVideoPath = tmpFile.Name()
		defer os.Remove(tmpVideoPath)

		if _, err := io.Copy(tmpFile, file); err != nil {
			tmpFile.Close()
			return apierr.Internal("failed to save video to temporary storage")
		}
		_, _ = tmpFile.Seek(0, io.SeekStart)

		res, err := a.S3.Upload(c.Request.Context(), "reels", videoHeader.Filename, tmpFile)
		tmpFile.Close()
		if err != nil {
			log.Printf("AWS S3 video upload error: %v", err)
			return apierr.Internal("failed to upload video to AWS S3: " + err.Error())
		}
		reel.VideoURL = res.URL
		reel.VideoRef = res.Key
	}

	// Thumbnail file (optional)
	thumbHeader, err := c.FormFile("thumbnail")
	if err == nil && thumbHeader != nil {
		if a.S3 == nil || !a.S3.IsConfigured() {
			return apierr.BadRequest("storage_not_configured", "AWS S3 storage is not configured")
		}
		file, err := thumbHeader.Open()
		if err != nil {
			return apierr.BadRequest("file_read_error", err.Error())
		}
		defer file.Close()

		res, err := a.S3.Upload(c.Request.Context(), "reels/thumbnails", thumbHeader.Filename, file)
		if err != nil {
			log.Printf("AWS S3 thumbnail upload error: %v", err)
			return apierr.Internal("failed to upload thumbnail to AWS S3: " + err.Error())
		}
		reel.ThumbnailURL = res.URL
		reel.ThumbnailRef = res.Key
	} else if tmpVideoPath != "" && reel.ThumbnailURL == "" {
		// Auto-extract thumbnail using ffmpeg if no thumbnail was provided
		baseName := strings.TrimSuffix(videoHeader.Filename, filepath.Ext(videoHeader.Filename))
		if thumbRes, err := a.S3.ExtractThumbnailFromVideo(c.Request.Context(), tmpVideoPath, "reels/thumbnails", baseName); err == nil {
			reel.ThumbnailURL = thumbRes.URL
			reel.ThumbnailRef = thumbRes.Key
		} else {
			log.Printf("auto thumbnail extraction notice: %v", err)
		}
	}

	return nil
}

func (a *API) resolveReelEvent(ctx context.Context, reel *models.Reel) {
	if reel.EventID == "" {
		return
	}
	ev, err := a.Cache.Get(ctx, reel.EventID)
	if err != nil || ev == nil {
		// Fallback to store
		ev, err = a.Store.GetEvent(ctx, reel.EventID)
	}
	if err == nil && ev != nil {
		reel.Event = &models.ReelEventInfo{
			ID:                 ev.ID,
			Name:               ev.Title,
			Description:        ev.ShortDescription,
			IsRegistrationOpen: ev.IsRegistrationOpen(time.Now().UTC()),
		}
	}
}

// reelRefs lists the S3 / storage files a reel owns.
func reelRefs(r *models.Reel) []string {
	return []string{r.VideoRef, r.ThumbnailRef}
}

func respondReelLookup(c *gin.Context, err error) {
	if errors.Is(err, store.ErrNotFound) {
		apierr.Respond(c, apierr.NotFound("reel_not_found", "no such reel"))
		return
	}
	apierr.Respond(c, apierr.Internal("could not load reel"))
}

func applyReelBody(r *models.Reel, body *reelBody) int {
	n := 0
	if body.Title != nil {
		r.Title = strings.TrimSpace(*body.Title)
		n++
	}
	if body.Description != nil {
		r.Description = strings.TrimSpace(*body.Description)
		n++
	}
	if body.VideoURL != nil {
		r.VideoURL = strings.TrimSpace(*body.VideoURL)
		r.VideoRef = ""
		n++
	} else if body.VideoLink != nil {
		r.VideoURL = strings.TrimSpace(*body.VideoLink)
		r.VideoRef = ""
		n++
	}
	if body.ThumbnailURL != nil {
		r.ThumbnailURL = strings.TrimSpace(*body.ThumbnailURL)
		r.ThumbnailRef = ""
		n++
	}
	if body.EventID != nil {
		r.EventID = strings.TrimSpace(*body.EventID)
		n++
	}
	if body.Event != nil {
		r.Event = body.Event
		n++
	}
	if body.Duration != nil {
		r.Duration = *body.Duration
		n++
	}
	if body.Order != nil {
		r.Order = *body.Order
		n++
	}
	return n
}

func validateReel(r *models.Reel) *apierr.Error {
	if r.Title == "" {
		return apierr.BadRequest("missing_fields", "reel title is required")
	}
	if r.VideoURL == "" {
		return apierr.BadRequest("missing_fields", "reel video URL or video file is required")
	}
	return nil
}
