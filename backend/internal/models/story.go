package models

import (
	"strings"
	"time"
)

// StoryItem represents an individual media item in an event story.
type StoryItem struct {
	ID         string    `json:"id"              firestore:"id"`
	URL        string    `json:"url"             firestore:"url"`
	Ref        string    `json:"ref,omitempty"   firestore:"ref,omitempty"`
	MediaType  string    `json:"mediaType"       firestore:"mediaType"` // "image" | "video"
	UploadedAt time.Time `json:"uploadedAt"      firestore:"uploadedAt"`
}

// Story represents an event story containing a collection of images or videos.
type Story struct {
	ID        string      `json:"id"                 firestore:"-"`
	Name      string      `json:"name"               firestore:"name"`
	EventID   string      `json:"eventId,omitempty"  firestore:"eventId,omitempty"`
	Images    []string    `json:"images"             firestore:"images"`
	Items     []StoryItem `json:"items,omitempty"    firestore:"items,omitempty"`
	Order     int         `json:"order"              firestore:"order"`
	CreatedAt time.Time   `json:"createdAt"          firestore:"createdAt"`
	UpdatedAt time.Time   `json:"updatedAt"          firestore:"updatedAt"`
}

func (s *Story) Normalise() {
	if s.Images == nil {
		s.Images = []string{}
	}
	if s.Items == nil {
		s.Items = []StoryItem{}
	}
	// Synchronize Images from Items if Items are populated
	if len(s.Images) == 0 && len(s.Items) > 0 {
		s.Images = make([]string, len(s.Items))
		for i, it := range s.Items {
			s.Images[i] = it.URL
		}
	}
	// Synchronize Items from Images if only legacy Images array was stored
	if len(s.Items) == 0 && len(s.Images) > 0 {
		now := time.Now().UTC()
		s.Items = make([]StoryItem, len(s.Images))
		for i, img := range s.Images {
			mediaType := "image"
			lower := strings.ToLower(img)
			if strings.HasSuffix(lower, ".mp4") || strings.HasSuffix(lower, ".mov") ||
				strings.HasSuffix(lower, ".webm") || strings.Contains(lower, "/videos/") {
				mediaType = "video"
			}
			s.Items[i] = StoryItem{
				ID:         img,
				URL:        img,
				MediaType:  mediaType,
				UploadedAt: now,
			}
		}
	}
}
