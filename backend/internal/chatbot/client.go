package chatbot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultChatbotURL = "https://satbot-backend-hnyj.onrender.com"

type ReferencedEvent struct {
	ID              string  `json:"id"`
	Title           string  `json:"title"`
	Category        string  `json:"category"`
	Venue           string  `json:"venue"`
	ScheduleIST     string  `json:"schedule_ist"`
	FeeDisplay      string  `json:"fee_display"`
	TeamSizeDisplay string  `json:"team_size_display"`
	ExternalURL     *string `json:"external_url"`
}

type ChatResponse struct {
	SessionID          string            `json:"session_id"`
	Response           string            `json:"response"`
	ReferencedEvents   []ReferencedEvent `json:"referenced_events"`
	SuggestedFollowups []string          `json:"suggested_followups"`
	Intent             string            `json:"intent"`
	ProviderUsed       string            `json:"provider_used"`
	Error              *string           `json:"error,omitempty"`
}

type chatRequest struct {
	Message   string `json:"message"`
	SessionID string `json:"session_id,omitempty"`
}

type resetRequest struct {
	SessionID string `json:"session_id"`
}

type Service struct {
	baseURL    string
	httpClient *http.Client
}

// NewService creates a client for calling the deployed SatBot backend.
func NewService(chatbotURL string) *Service {
	url := strings.TrimRight(strings.TrimSpace(chatbotURL), "/")
	if url == "" {
		url = defaultChatbotURL
	}
	return &Service{
		baseURL: url,
		httpClient: &http.Client{
			Timeout: 45 * time.Second, // Allow Render free tier cold-start
		},
	}
}

// Ask sends the user's message to the deployed SatBot backend (/api/chat) and returns the response.
func (s *Service) Ask(ctx context.Context, message, sessionID string) (*ChatResponse, error) {
	reqBody := chatRequest{
		Message:   message,
		SessionID: sessionID,
	}
	data, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to encode request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/api/chat", bytes.NewBuffer(data))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("satbot request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("satbot returned HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var cr ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		return nil, fmt.Errorf("failed to parse satbot response: %w", err)
	}

	if cr.SessionID == "" {
		cr.SessionID = sessionID
	}
	return &cr, nil
}

// Reset clears conversational memory for a given session on the SatBot backend (/api/chat/reset).
func (s *Service) Reset(ctx context.Context, sessionID string) error {
	if sessionID == "" {
		return nil
	}
	reqBody := resetRequest{SessionID: sessionID}
	data, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/api/chat/reset", bytes.NewBuffer(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}
