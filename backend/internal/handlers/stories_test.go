package handlers

import (
	"testing"
	"time"

	"backend/internal/models"
)

func TestApplyStoryBodyOverlaysOnlySuppliedFields(t *testing.T) {
	s := func(v string) *string { return &v }
	i := func(v int) *int { return &v }

	story := &models.Story{
		ID:        "s1",
		Name:      "Day 1 Highlights",
		EventID:   "ev1",
		Images:    []string{"https://example.com/1.jpg"},
		Order:     1,
		CreatedAt: time.Now().UTC(),
	}

	n := applyStoryBody(story, &storyBody{
		Name:  s("Day 1 Best Moments"),
		Order: i(3),
	})

	if n != 2 {
		t.Fatalf("expected 2 applied fields, got %d", n)
	}
	if story.Name != "Day 1 Best Moments" {
		t.Errorf("name = %q, want 'Day 1 Best Moments'", story.Name)
	}
	if story.Order != 3 {
		t.Errorf("order = %d, want 3", story.Order)
	}
	if story.EventID != "ev1" {
		t.Errorf("unpatched eventID should survive, got %q", story.EventID)
	}
	if len(story.Images) != 1 || story.Images[0] != "https://example.com/1.jpg" {
		t.Errorf("unpatched images should survive, got %v", story.Images)
	}
}

func TestApplyStoryBodyUpdatesImagesAndItems(t *testing.T) {
	story := &models.Story{
		ID:   "s1",
		Name: "Day 1",
	}

	images := []string{"https://example.com/1.jpg", "https://example.com/video.mp4"}
	n := applyStoryBody(story, &storyBody{
		Images: &images,
	})

	if n != 1 {
		t.Fatalf("expected 1 applied field, got %d", n)
	}
	if len(story.Images) != 2 {
		t.Errorf("images length = %d, want 2", len(story.Images))
	}
	if len(story.Items) != 2 {
		t.Errorf("items length = %d, want 2", len(story.Items))
	}
	if story.Items[0].MediaType != "image" {
		t.Errorf("items[0].MediaType = %q, want image", story.Items[0].MediaType)
	}
	if story.Items[1].MediaType != "video" {
		t.Errorf("items[1].MediaType = %q, want video", story.Items[1].MediaType)
	}
}

func TestApplyStoryBodyDirectItems(t *testing.T) {
	story := &models.Story{
		ID:   "s2",
		Name: "Day 2",
	}

	items := []models.StoryItem{
		{
			ID:        "item1",
			URL:       "https://bucket.s3.region.amazonaws.com/stories/videos/clip.mp4",
			MediaType: "video",
			Ref:       "stories/videos/clip.mp4",
		},
		{
			ID:        "item2",
			URL:       "https://ik.imagekit.io/sat/stories/photo.jpg",
			MediaType: "image",
			Ref:       "acc1|file2|1000|stories/photo.jpg",
		},
	}

	n := applyStoryBody(story, &storyBody{
		Items: &items,
	})

	if n != 1 {
		t.Fatalf("expected 1 applied field, got %d", n)
	}
	if len(story.Items) != 2 {
		t.Fatalf("items length = %d, want 2", len(story.Items))
	}
	if len(story.Images) != 2 {
		t.Fatalf("images length = %d, want 2", len(story.Images))
	}
	if story.Items[0].MediaType != "video" || story.Items[1].MediaType != "image" {
		t.Errorf("media types mismatch: %v", story.Items)
	}
}

func TestValidateStory(t *testing.T) {
	cases := []struct {
		name    string
		story   models.Story
		wantErr bool
	}{
		{
			name: "valid story with images",
			story: models.Story{
				Name:   "Concert Night",
				Images: []string{"https://example.com/1.jpg"},
			},
			wantErr: false,
		},
		{
			name: "valid story with items only (video)",
			story: models.Story{
				Name: "Video Story",
				Items: []models.StoryItem{
					{
						URL:       "https://s3.amazonaws.com/stories/videos/vid.mp4",
						MediaType: "video",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "missing name",
			story: models.Story{
				Images: []string{"https://example.com/1.jpg"},
			},
			wantErr: true,
		},
		{
			name: "empty images and items",
			story: models.Story{
				Name:   "Concert Night",
				Images: []string{},
				Items:  []models.StoryItem{},
			},
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateStory(&tc.story)
			if (err != nil) != tc.wantErr {
				t.Errorf("validateStory() error = %v, wantErr %v", err, tc.wantErr)
			}
		})
	}
}

func TestIsVideoFileAndIsS3Ref(t *testing.T) {
	if !isVideoFile("test.mp4", "") {
		t.Errorf("expected test.mp4 to be video")
	}
	if !isVideoFile("test.mov", "") {
		t.Errorf("expected test.mov to be video")
	}
	if !isVideoFile("unknown", "video/webm") {
		t.Errorf("expected video/webm content type to be video")
	}
	if isVideoFile("photo.png", "image/png") {
		t.Errorf("expected photo.png to NOT be video")
	}

	if !isS3Ref("stories/videos/test.mp4") {
		t.Errorf("expected stories/videos/test.mp4 to be S3 ref")
	}
	if !isS3Ref("reels/reel_123.mp4") {
		t.Errorf("expected reels/reel_123.mp4 to be S3 ref")
	}
	if isS3Ref("ik_acc1|file_abc|1024|stories/img.jpg") {
		t.Errorf("expected imagekit pipe ref to NOT be S3 ref")
	}
}
