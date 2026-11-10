package s3storage

import (
	"testing"
)

func TestClient_IsConfigured(t *testing.T) {
	c1 := NewClient("", "", "", "")
	if c1.IsConfigured() {
		t.Errorf("expected empty client to not be configured")
	}

	c2 := NewClient("ap-south-1", "my-bucket", "key", "secret")
	if !c2.IsConfigured() {
		t.Errorf("expected client with credentials to be configured")
	}
}

func TestClient_PublicURL(t *testing.T) {
	c := NewClient("ap-south-1", "sat-2026-aargh", "key", "secret")
	url := c.PublicURL("reels/video.mp4")
	expected := "https://sat-2026-aargh.s3.ap-south-1.amazonaws.com/reels/video.mp4"
	if url != expected {
		t.Errorf("got %q, want %q", url, expected)
	}

	// Leading slash should be trimmed
	url2 := c.PublicURL("/reels/video.mp4")
	if url2 != expected {
		t.Errorf("got %q, want %q", url2, expected)
	}
}
