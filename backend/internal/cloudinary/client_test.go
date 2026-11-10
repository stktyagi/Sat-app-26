package cloudinary

import (
	"testing"
)

func TestGenerateAutoThumbnailURL(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "standard video url",
			input:    "https://res.cloudinary.com/tn096flf/video/upload/v1794299944/sat26/reels/dance.mp4",
			expected: "https://res.cloudinary.com/tn096flf/video/upload/so_0,q_auto:eco,w_720/v1794299944/sat26/reels/dance.jpg",
		},
		{
			name:     "already transformed url",
			input:    "https://res.cloudinary.com/tn096flf/video/upload/so_0,q_auto:eco,w_720/v1794299944/sat26/reels/dance.jpg",
			expected: "https://res.cloudinary.com/tn096flf/video/upload/so_0,q_auto:eco,w_720/v1794299944/sat26/reels/dance.jpg",
		},
		{
			name:     "non-cloudinary url",
			input:    "https://example.com/video.mp4",
			expected: "https://example.com/video.mp4",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := GenerateAutoThumbnailURL(tt.input)
			if got != tt.expected {
				t.Errorf("got %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestClient_IsConfigured(t *testing.T) {
	c1 := NewClient("", "", "")
	if c1.IsConfigured() {
		t.Errorf("expected empty client to not be configured")
	}

	c2 := NewClient("cloud", "key", "secret")
	if !c2.IsConfigured() {
		t.Errorf("expected valid client to be configured")
	}
}

func TestClient_Sign(t *testing.T) {
	c := NewClient("test", "key", "secret123")
	params := map[string]string{
		"timestamp": "1234567890",
		"folder":    "sat26/reels",
	}
	sig := c.sign(params)
	if sig == "" {
		t.Errorf("expected non-empty signature")
	}
}
