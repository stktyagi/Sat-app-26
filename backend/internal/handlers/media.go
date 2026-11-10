package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/apierr"
)

type deleteMediaBody struct {
	Ref string `json:"ref" form:"ref"`
}

// UploadMedia handles uploading media files. When folder starts with "reels",
// it transparently routes to AWS S3. For all other folders, it uses ImageKit.
// Accepts multipart/form-data with file field ("file", "media", "image", or "video")
// and optional "folder" form field (defaults to "general").
func (a *API) UploadMedia(c *gin.Context) {
	folder := strings.TrimSpace(c.DefaultPostForm("folder", "general"))
	if folder == "" {
		folder = "general"
	}

	fileHeader, err := c.FormFile("file")
	if errors.Is(err, http.ErrMissingFile) {
		fileHeader, err = c.FormFile("media")
	}
	if errors.Is(err, http.ErrMissingFile) {
		fileHeader, err = c.FormFile("image")
	}
	if errors.Is(err, http.ErrMissingFile) {
		fileHeader, err = c.FormFile("video")
	}
	if err != nil || fileHeader == nil {
		apierr.Respond(c, apierr.BadRequest("missing_file", "media file is required"))
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		apierr.Respond(c, apierr.BadRequest("file_read_error", err.Error()))
		return
	}
	defer file.Close()

	// Transparently route reels to AWS S3
	if strings.HasPrefix(folder, "reels") {
		if a.S3 == nil || !a.S3.IsConfigured() {
			apierr.Respond(c, apierr.BadRequest("storage_not_configured", "AWS S3 storage is not configured"))
			return
		}

		res, err := a.S3.Upload(c.Request.Context(), folder, fileHeader.Filename, file)
		if err != nil {
			log.Printf("UploadMedia (S3 upload error): %v", err)
			apierr.Respond(c, apierr.Internal("failed to upload media to AWS S3: "+err.Error()))
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"url":    res.URL,
			"ref":    res.Key,
			"name":   fileHeader.Filename,
			"size":   fileHeader.Size,
			"folder": folder,
		})
		return
	}

	// Default to ImageKit for other folders
	if a.Storage == nil {
		apierr.Respond(c, apierr.BadRequest("storage_not_configured", "ImageKit storage is not configured"))
		return
	}

	ref, url, err := a.Storage.UploadFile(c.Request.Context(), folder, fileHeader.Filename, file)
	if err != nil {
		log.Printf("UploadMedia error: %v", err)
		apierr.Respond(c, apierr.Internal("failed to upload media to ImageKit"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":    url,
		"ref":    ref,
		"name":   fileHeader.Filename,
		"size":   fileHeader.Size,
		"folder": folder,
	})
}

// DeleteMedia deletes a file given its reference string (supporting both AWS S3 and ImageKit).
func (a *API) DeleteMedia(c *gin.Context) {
	ref := strings.TrimSpace(c.Query("ref"))
	if ref == "" {
		var body deleteMediaBody
		_ = c.ShouldBind(&body)
		ref = strings.TrimSpace(body.Ref)
	}

	if ref == "" {
		apierr.Respond(c, apierr.BadRequest("missing_ref", "ref parameter is required"))
		return
	}

	if strings.HasPrefix(ref, "reels/") || strings.HasPrefix(ref, "reels") {
		if a.S3 != nil && a.S3.IsConfigured() {
			if err := a.S3.Delete(c.Request.Context(), ref); err != nil {
				log.Printf("DeleteMedia (S3 error): %v", err)
			}
		}
		c.Status(http.StatusNoContent)
		return
	}

	if a.Storage == nil {
		apierr.Respond(c, apierr.BadRequest("storage_not_configured", "ImageKit storage is not configured"))
		return
	}

	if err := a.Storage.Delete(c.Request.Context(), ref); err != nil {
		log.Printf("DeleteMedia error: %v", err)
		apierr.Respond(c, apierr.Internal("failed to delete media from ImageKit"))
		return
	}

	c.Status(http.StatusNoContent)
}

// settleMedia deletes the files a write left unreferenced (both AWS S3 and ImageKit).
func (a *API) settleMedia(saved bool, before, after []string) {
	drop := missingRefs(after, before)
	if saved {
		drop = missingRefs(before, after)
	}
	if len(drop) == 0 {
		return
	}
	go func() {
		for _, ref := range drop {
			if strings.HasPrefix(ref, "reels") && a.S3 != nil && a.S3.IsConfigured() {
				_ = a.S3.Delete(context.Background(), ref)
			} else if a.Storage != nil {
				if err := a.Storage.Delete(context.Background(), ref); err != nil {
					log.Printf("storage: deleting unreferenced media %q: %v", ref, err)
				}
			}
		}
	}()
}

// missingRefs returns the non-empty refs in from that are not in in.
func missingRefs(from, in []string) []string {
	var out []string
	for _, r := range from {
		if r != "" && !slices.Contains(in, r) {
			out = append(out, r)
		}
	}
	return out
}
