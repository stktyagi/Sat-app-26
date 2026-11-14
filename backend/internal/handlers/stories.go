package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
	"backend/internal/models"
	"backend/internal/random"
	"backend/internal/store"
)

type storyBody struct {
	Name    *string             `json:"name"    form:"name"`
	EventID *string             `json:"eventId" form:"eventId"`
	Images  *[]string           `json:"images"`
	Items   *[]models.StoryItem `json:"items"`
	Order   *int                `json:"order"   form:"order"`
}

// ListStories returns all event stories for users.
func (a *API) ListStories(c *gin.Context) {
	all, err := a.Stories.All(c.Request.Context())
	if err != nil {
		log.Printf("ListStories error: %v", err)
		apierr.Respond(c, apierr.Internal("could not load stories"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": all})
}

// GetStory returns a single event story by ID for users.
func (a *API) GetStory(c *gin.Context) {
	st, err := a.Store.GetStory(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondStoryLookup(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"story": st})
}

// AdminListStories returns all stories for admins.
func (a *API) AdminListStories(c *gin.Context) {
	all, err := a.Stories.All(c.Request.Context())
	if err != nil {
		log.Printf("AdminListStories error: %v", err)
		apierr.Respond(c, apierr.Internal("could not load stories"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": all})
}

// AdminGetStory returns any story by ID for admins.
func (a *API) AdminGetStory(c *gin.Context) {
	st, err := a.Store.GetStory(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondStoryLookup(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"story": st})
}

// CreateStory handles creating a story. Supports multipart media upload
// or JSON with images/items array.
func (a *API) CreateStory(c *gin.Context) {
	var body storyBody

	contentType := c.ContentType()
	isMultipart := strings.HasPrefix(contentType, "multipart/form-data")

	if isMultipart {
		if err := c.ShouldBind(&body); err != nil {
			apierr.Respond(c, apierr.BadRequest("invalid_form", err.Error()))
			return
		}
	} else {
		if !bind(c, &body) {
			return
		}
	}

	story := &models.Story{}
	applyStoryBody(story, &body)
	saved := false
	defer func() { a.settleMedia(saved, nil, storyRefs(story)) }()

	// If media files were uploaded in multipart form, upload videos to S3 and images to ImageKit
	if isMultipart {
		if err := a.handleStoryFileUploads(c, story); err != nil {
			apierr.Respond(c, err)
			return
		}
	}

	if err := validateStory(story); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.CreateStory(c.Request.Context(), story); err != nil {
		log.Printf("CreateStory error: %v", err)
		apierr.Respond(c, apierr.Internal("could not create story"))
		return
	}
	saved = true
	a.Stories.Invalidate()

	c.JSON(http.StatusCreated, gin.H{"story": story})
}

// UpdateStory applies a partial update to an existing story.
func (a *API) UpdateStory(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	story, err := a.Store.GetStory(ctx, id)
	if err != nil {
		respondStoryLookup(c, err)
		return
	}
	before := storyRefs(story)
	saved := false
	defer func() { a.settleMedia(saved, before, storyRefs(story)) }()

	var body storyBody
	contentType := c.ContentType()
	isMultipart := strings.HasPrefix(contentType, "multipart/form-data")

	if isMultipart {
		if err := c.ShouldBind(&body); err != nil {
			apierr.Respond(c, apierr.BadRequest("invalid_form", err.Error()))
			return
		}
	} else {
		if !bind(c, &body) {
			return
		}
	}

	n := applyStoryBody(story, &body)

	if isMultipart {
		beforeCount := len(story.Items)
		if err := a.handleStoryFileUploads(c, story); err != nil {
			apierr.Respond(c, err)
			return
		}
		if len(story.Items) > beforeCount {
			n++
		}
	}

	if n == 0 {
		apierr.Respond(c, apierr.BadRequest("empty_patch", "no updatable fields supplied"))
		return
	}

	if err := validateStory(story); err != nil {
		apierr.Respond(c, err)
		return
	}

	if err := a.Store.SaveStory(ctx, story); err != nil {
		log.Printf("SaveStory error: %v", err)
		apierr.Respond(c, apierr.Internal("could not update story"))
		return
	}
	saved = true
	a.Stories.Invalidate()

	c.JSON(http.StatusOK, gin.H{"story": story})
}

// DeleteStory removes a story.
func (a *API) DeleteStory(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	story, err := a.Store.GetStory(ctx, id)
	if err != nil {
		respondStoryLookup(c, err)
		return
	}

	if err := a.Store.DeleteStory(ctx, id); err != nil {
		log.Printf("DeleteStory error: %v", err)
		apierr.Respond(c, apierr.Internal("could not delete story"))
		return
	}
	a.Stories.Invalidate()

	a.settleMedia(true, storyRefs(story), nil)

	c.Status(http.StatusNoContent)
}

func (a *API) handleStoryFileUploads(c *gin.Context, story *models.Story) *apierr.Error {
	form, err := c.MultipartForm()
	if err != nil {
		return nil // no multipart form files
	}

	fileHeaders := form.File["images"]
	if len(fileHeaders) == 0 {
		fileHeaders = form.File["videos"]
	}
	if len(fileHeaders) == 0 {
		fileHeaders = form.File["files"]
	}
	if len(fileHeaders) == 0 {
		fileHeaders = form.File["media"]
	}
	if len(fileHeaders) == 0 {
		if fh, err := c.FormFile("image"); err == nil && fh != nil {
			fileHeaders = append(fileHeaders, fh)
		}
	}
	if len(fileHeaders) == 0 {
		if fh, err := c.FormFile("video"); err == nil && fh != nil {
			fileHeaders = append(fileHeaders, fh)
		}
	}
	if len(fileHeaders) == 0 {
		if fh, err := c.FormFile("file"); err == nil && fh != nil {
			fileHeaders = append(fileHeaders, fh)
		}
	}

	if len(fileHeaders) == 0 {
		return nil
	}

	now := time.Now().UTC()
	for _, fh := range fileHeaders {
		f, err := fh.Open()
		if err != nil {
			return apierr.BadRequest("file_read_error", err.Error())
		}
		defer f.Close()

		isVideo := isVideoFile(fh.Filename, fh.Header.Get("Content-Type"))
		var (
			ref       string
			url       string
			mediaType string
		)

		if isVideo {
			if a.S3 == nil || !a.S3.IsConfigured() {
				return apierr.BadRequest("storage_not_configured", "AWS S3 storage is not configured")
			}
			res, err := a.S3.Upload(c.Request.Context(), "stories/videos", fh.Filename, f)
			if err != nil {
				log.Printf("AWS S3 story video upload error: %v", err)
				return apierr.Internal("failed to upload story video to AWS S3: " + err.Error())
			}
			ref = res.Key
			url = res.URL
			mediaType = "video"
		} else {
			if a.Storage == nil {
				return apierr.BadRequest("storage_not_configured", "ImageKit storage is not configured")
			}
			ikRef, ikURL, err := a.Storage.UploadFile(c.Request.Context(), "stories", fh.Filename, f)
			if err != nil {
				log.Printf("ImageKit story image upload error: %v", err)
				return apierr.Internal("failed to upload story image to ImageKit")
			}
			ref = ikRef
			url = ikURL
			mediaType = "image"
		}

		story.Images = append(story.Images, url)
		story.Items = append(story.Items, models.StoryItem{
			ID:         random.Code(12),
			URL:        url,
			Ref:        ref,
			MediaType:  mediaType,
			UploadedAt: now,
		})
	}

	return nil
}

// storyRefs lists the media references (ImageKit and AWS S3) a story owns.
func storyRefs(st *models.Story) []string {
	refs := make([]string, 0, len(st.Items))
	for _, it := range st.Items {
		refs = append(refs, it.Ref)
	}
	return refs
}

func respondStoryLookup(c *gin.Context, err error) {
	if errors.Is(err, store.ErrNotFound) {
		apierr.Respond(c, apierr.NotFound("story_not_found", "no such story"))
		return
	}
	apierr.Respond(c, apierr.Internal("could not load story"))
}

func applyStoryBody(st *models.Story, body *storyBody) int {
	n := 0
	if body.Name != nil {
		st.Name = strings.TrimSpace(*body.Name)
		n++
	}
	if body.EventID != nil {
		st.EventID = strings.TrimSpace(*body.EventID)
		n++
	}
	if body.Order != nil {
		st.Order = *body.Order
		n++
	}
	if body.Items != nil {
		st.Items = *body.Items
		now := time.Now().UTC()
		st.Images = make([]string, len(st.Items))
		for i := range st.Items {
			if st.Items[i].ID == "" {
				st.Items[i].ID = random.Code(12)
			}
			if st.Items[i].UploadedAt.IsZero() {
				st.Items[i].UploadedAt = now
			}
			if st.Items[i].MediaType == "" {
				if isVideoFile(st.Items[i].URL, "") {
					st.Items[i].MediaType = "video"
				} else {
					st.Items[i].MediaType = "image"
				}
			}
			st.Images[i] = st.Items[i].URL
		}
		n++
	} else if body.Images != nil {
		st.Images = *body.Images
		// Keep the existing item for any URL that survives, so its ref
		// is not lost and the file stays deletable.
		kept := make(map[string]models.StoryItem, len(st.Items))
		for _, it := range st.Items {
			kept[it.URL] = it
		}
		now := time.Now().UTC()
		st.Items = make([]models.StoryItem, len(st.Images))
		for i, img := range st.Images {
			if it, ok := kept[img]; ok {
				st.Items[i] = it
				continue
			}
			mediaType := "image"
			if isVideoFile(img, "") {
				mediaType = "video"
			}
			st.Items[i] = models.StoryItem{
				ID:         random.Code(12),
				URL:        img,
				MediaType:  mediaType,
				UploadedAt: now,
			}
		}
		n++
	}
	return n
}

func validateStory(st *models.Story) *apierr.Error {
	if st.Name == "" {
		return apierr.BadRequest("missing_fields", "story name is required")
	}
	if len(st.Images) == 0 && len(st.Items) == 0 {
		return apierr.BadRequest("missing_fields", "at least one image or video is required for the story")
	}
	st.Normalise()
	return nil
}
