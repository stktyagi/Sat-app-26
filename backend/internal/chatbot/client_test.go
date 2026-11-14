package chatbot

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAsk(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/chat" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		var req chatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("bad request: %v", err)
		}
		if req.Message != "What is SatHack?" {
			t.Errorf("got message %q, want 'What is SatHack?'", req.Message)
		}
		if req.SessionID != "test-sess-1" {
			t.Errorf("got session %q, want 'test-sess-1'", req.SessionID)
		}

		resp := ChatResponse{
			SessionID: "test-sess-1",
			Response:  "SatHack is a 36-hour hackathon.",
			Intent:    "event_query",
			ReferencedEvents: []ReferencedEvent{
				{
					ID:    "sathack",
					Title: "SatHack 2026",
					Venue: "LT 101",
				},
			},
			SuggestedFollowups: []string{"When does it start?"},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer ts.Close()

	svc := NewService(ts.URL)
	res, err := svc.Ask(context.Background(), "What is SatHack?", "test-sess-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Response != "SatHack is a 36-hour hackathon." {
		t.Errorf("unexpected response: %s", res.Response)
	}
	if len(res.ReferencedEvents) != 1 || res.ReferencedEvents[0].ID != "sathack" {
		t.Errorf("unexpected referenced events: %+v", res.ReferencedEvents)
	}
}

func TestReset(t *testing.T) {
	called := false
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/chat/reset" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	svc := NewService(ts.URL)
	err := svc.Reset(context.Background(), "test-sess-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Errorf("reset was not called")
	}
}
