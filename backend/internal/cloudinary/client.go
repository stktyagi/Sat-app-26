package cloudinary

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Client handles uploads, deletions, and transformations against Cloudinary's
// REST API using standard HTTP multipart forms and HMAC signatures.
type Client struct {
	CloudName  string
	APIKey     string
	APISecret  string
	HTTPClient *http.Client
}

// UploadResult contains the asset details returned by Cloudinary.
type UploadResult struct {
	PublicID  string  `json:"public_id"`
	SecureURL string  `json:"secure_url"`
	Format    string  `json:"format"`
	Width     int     `json:"width"`
	Height    int     `json:"height"`
	Duration  float64 `json:"duration"`
	Bytes     int64   `json:"bytes"`
}

type destroyResponse struct {
	Result string `json:"result"`
	Error  *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// NewClient returns a configured Cloudinary client.
func NewClient(cloudName, apiKey, apiSecret string) *Client {
	return &Client{
		CloudName:  strings.TrimSpace(cloudName),
		APIKey:     strings.TrimSpace(apiKey),
		APISecret:  strings.TrimSpace(apiSecret),
		HTTPClient: &http.Client{Timeout: 10 * time.Minute},
	}
}

// IsConfigured returns true if all 3 Cloudinary credentials are present.
func (c *Client) IsConfigured() bool {
	return c != nil && c.CloudName != "" && c.APIKey != "" && c.APISecret != ""
}

// UploadVideo streams a video to Cloudinary under folder with minimum transformation credit usage.
func (c *Client) UploadVideo(ctx context.Context, folder, filename string, r io.Reader) (*UploadResult, error) {
	return c.upload(ctx, "video", folder, filename, r)
}

// UploadImage streams an image to Cloudinary under folder.
func (c *Client) UploadImage(ctx context.Context, folder, filename string, r io.Reader) (*UploadResult, error) {
	return c.upload(ctx, "image", folder, filename, r)
}

func (c *Client) upload(ctx context.Context, resourceType, folder, filename string, r io.Reader) (*UploadResult, error) {
	if !c.IsConfigured() {
		return nil, errors.New("cloudinary is not configured: check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET")
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	params := map[string]string{
		"timestamp": timestamp,
	}
	if folder != "" {
		params["folder"] = folder
	}

	sig := c.sign(params)

	if filename == "" {
		filename = "file"
	}

	pr, pw := io.Pipe()
	w := multipart.NewWriter(pw)

	go func() {
		var writeErr error
		defer func() {
			if writeErr != nil {
				pw.CloseWithError(writeErr)
			} else {
				pw.Close()
			}
		}()

		for k, v := range params {
			if err := w.WriteField(k, v); err != nil {
				writeErr = err
				return
			}
		}
		if err := w.WriteField("api_key", c.APIKey); err != nil {
			writeErr = err
			return
		}
		if err := w.WriteField("signature", sig); err != nil {
			writeErr = err
			return
		}

		part, err := w.CreateFormFile("file", filename)
		if err != nil {
			writeErr = fmt.Errorf("creating form file: %w", err)
			return
		}
		if _, err := io.Copy(part, r); err != nil {
			writeErr = fmt.Errorf("copying payload: %w", err)
			return
		}
		if err := w.Close(); err != nil {
			writeErr = fmt.Errorf("closing multipart: %w", err)
			return
		}
	}()

	endpoint := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/%s/upload", url.PathEscape(c.CloudName), resourceType)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, pr)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())

	res, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cloudinary upload request failed: %w", err)
	}
	defer res.Body.Close()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("reading cloudinary response: %w", err)
	}

	if res.StatusCode != http.StatusOK {
		var errResp struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.Unmarshal(bodyBytes, &errResp)
		if errResp.Error.Message != "" {
			return nil, fmt.Errorf("cloudinary error (%d): %s", res.StatusCode, errResp.Error.Message)
		}
		return nil, fmt.Errorf("cloudinary error (%d): %s", res.StatusCode, string(bodyBytes))
	}

	var result UploadResult
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return nil, fmt.Errorf("unmarshaling upload response: %w", err)
	}
	return &result, nil
}

// DeleteAsset removes a video or image from Cloudinary by its public ID.
func (c *Client) DeleteAsset(ctx context.Context, publicID, resourceType string) error {
	if !c.IsConfigured() {
		return errors.New("cloudinary is not configured")
	}
	if publicID == "" {
		return nil
	}
	if resourceType == "" {
		resourceType = "video"
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	params := map[string]string{
		"public_id": publicID,
		"timestamp": timestamp,
	}

	sig := c.sign(params)

	form := url.Values{}
	form.Set("public_id", publicID)
	form.Set("timestamp", timestamp)
	form.Set("api_key", c.APIKey)
	form.Set("signature", sig)

	endpoint := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/%s/destroy", url.PathEscape(c.CloudName), resourceType)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	res, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("cloudinary destroy request failed: %w", err)
	}
	defer res.Body.Close()

	var destResp destroyResponse
	if err := json.NewDecoder(res.Body).Decode(&destResp); err != nil {
		return fmt.Errorf("parsing destroy response: %w", err)
	}
	if destResp.Result != "ok" && destResp.Result != "not found" {
		if destResp.Error != nil && destResp.Error.Message != "" {
			return fmt.Errorf("cloudinary destroy failed: %s", destResp.Error.Message)
		}
		return fmt.Errorf("cloudinary destroy result: %s", destResp.Result)
	}
	return nil
}

// GenerateAutoThumbnailURL converts a Cloudinary video URL into an instant
// lightweight JPEG thumbnail at 0s (`so_0,q_auto:eco,w_720`).
//
// E.g.
// https://res.cloudinary.com/demo/video/upload/v1234/sample.mp4
// ->
// https://res.cloudinary.com/demo/video/upload/so_0,q_auto:eco,w_720/v1234/sample.jpg
func GenerateAutoThumbnailURL(videoURL string) string {
	if !strings.Contains(videoURL, "cloudinary.com") {
		return videoURL
	}
	ext := filepath.Ext(videoURL)
	if ext == "" {
		return videoURL
	}

	// Replace video extension with .jpg
	imgURL := strings.TrimSuffix(videoURL, ext) + ".jpg"

	// Insert transformation after "/upload/"
	needle := "/video/upload/"
	idx := strings.Index(imgURL, needle)
	if idx != -1 {
		prefix := imgURL[:idx+len(needle)]
		suffix := imgURL[idx+len(needle):]
		// Avoid duplicate transform if already present
		if !strings.HasPrefix(suffix, "so_0") {
			return prefix + "so_0,q_auto:eco,w_720/" + suffix
		}
	}
	return imgURL
}

func (c *Client) sign(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var pairs []string
	for _, k := range keys {
		pairs = append(pairs, fmt.Sprintf("%s=%s", k, params[k]))
	}

	toSign := strings.Join(pairs, "&") + c.APISecret
	h := sha1.New()
	h.Write([]byte(toSign))
	return hex.EncodeToString(h.Sum(nil))
}
