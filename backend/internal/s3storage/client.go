package s3storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

// Client wraps the AWS S3 client for video reels and thumbnails.
type Client struct {
	Region string
	Bucket string
	s3     *s3.Client
}

// UploadResult contains the details of an uploaded S3 object.
type UploadResult struct {
	Key       string `json:"key"`
	URL       string `json:"url"`
	Bytes     int64  `json:"bytes"`
	MediaType string `json:"mediaType"`
}

// NewClient initializes an S3 client. If credentials are missing, it returns an unconfigured client.
func NewClient(region, bucket, accessKey, secretKey string) *Client {
	region = strings.TrimSpace(region)
	bucket = strings.TrimSpace(bucket)
	accessKey = strings.TrimSpace(accessKey)
	secretKey = strings.TrimSpace(secretKey)

	if region == "" || bucket == "" || accessKey == "" || secretKey == "" {
		return &Client{
			Region: region,
			Bucket: bucket,
			s3:     nil,
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	creds := credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")
	cfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(creds),
	)
	if err != nil {
		return &Client{Region: region, Bucket: bucket, s3: nil}
	}

	return &Client{
		Region: region,
		Bucket: bucket,
		s3:     s3.NewFromConfig(cfg),
	}
}

// IsConfigured returns true if AWS credentials and bucket are configured.
func (c *Client) IsConfigured() bool {
	return c != nil && c.s3 != nil && c.Bucket != "" && c.Region != ""
}

// PublicURL returns the standard HTTPS URL for an S3 object key.
func (c *Client) PublicURL(key string) string {
	cleanKey := strings.TrimPrefix(key, "/")
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", c.Bucket, c.Region, cleanKey)
}

// detectContentType returns the MIME type based on file extension.
func detectContentType(ext string) string {
	switch strings.ToLower(ext) {
	case ".mp4":
		return "video/mp4"
	case ".mov":
		return "video/quicktime"
	case ".webm":
		return "video/webm"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	default:
		return "application/octet-stream"
	}
}

// Upload streams r to S3 under folder/filename with a generated unique ID.
func (c *Client) Upload(ctx context.Context, folder, filename string, r io.Reader) (*UploadResult, error) {
	if !c.IsConfigured() {
		return nil, errors.New("aws s3 storage is not configured")
	}

	ext := strings.ToLower(filepath.Ext(filename))
	base := strings.TrimSuffix(filepath.Base(filename), ext)
	if base == "" {
		base = "reel"
	}
	cleanFolder := strings.Trim(folder, "/")
	uniqueKey := path.Join(cleanFolder, fmt.Sprintf("%s_%s%s", base, uuid.New().String()[:8], ext))
	contentType := detectContentType(ext)

	// If r is an *os.File, we can stream directly without reading into memory buffer
	if f, ok := r.(*os.File); ok {
		stat, err := f.Stat()
		if err == nil {
			_, err = c.s3.PutObject(ctx, &s3.PutObjectInput{
				Bucket:        aws.String(c.Bucket),
				Key:           aws.String(uniqueKey),
				Body:          f,
				ContentLength: aws.Int64(stat.Size()),
				ContentType:   aws.String(contentType),
			})
			if err != nil {
				return nil, fmt.Errorf("s3 put object: %w", err)
			}
			return &UploadResult{
				Key:       uniqueKey,
				URL:       c.PublicURL(uniqueKey),
				Bytes:     stat.Size(),
				MediaType: contentType,
			}, nil
		}
	}

	// Read content into buffer for size & upload
	var buf bytes.Buffer
	n, err := io.Copy(&buf, r)
	if err != nil {
		return nil, fmt.Errorf("reading upload stream: %w", err)
	}

	_, err = c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(c.Bucket),
		Key:           aws.String(uniqueKey),
		Body:          bytes.NewReader(buf.Bytes()),
		ContentLength: aws.Int64(n),
		ContentType:   aws.String(contentType),
	})
	if err != nil {
		return nil, fmt.Errorf("s3 put object: %w", err)
	}

	return &UploadResult{
		Key:       uniqueKey,
		URL:       c.PublicURL(uniqueKey),
		Bytes:     n,
		MediaType: contentType,
	}, nil
}

// UploadFile streams a file directly from local disk to S3.
func (c *Client) UploadFile(ctx context.Context, folder, filePath string) (*UploadResult, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	return c.Upload(ctx, folder, filepath.Base(filePath), f)
}

// Delete removes an object from S3.
func (c *Client) Delete(ctx context.Context, key string) error {
	if !c.IsConfigured() || strings.TrimSpace(key) == "" {
		return nil
	}
	cleanKey := strings.TrimPrefix(key, "/")
	_, err := c.s3.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.Bucket),
		Key:    aws.String(cleanKey),
	})
	return err
}

// ExtractThumbnailFromVideo uses ffmpeg to capture the first frame of a local video file
// and uploads it to S3 as a high-quality JPEG.
func (c *Client) ExtractThumbnailFromVideo(ctx context.Context, videoFilePath, targetFolder, baseName string) (*UploadResult, error) {
	if !c.IsConfigured() {
		return nil, errors.New("aws s3 storage is not configured")
	}

	tmpThumbPath := filepath.Join(os.TempDir(), fmt.Sprintf("thumb_%s_%s.jpg", baseName, uuid.New().String()[:8]))
	defer os.Remove(tmpThumbPath)

	// ffmpeg command to extract frame 0 as JPEG with -frames:v 1 -update 1
	cmd := exec.CommandContext(ctx, "ffmpeg", "-y", "-ss", "00:00:00", "-i", videoFilePath, "-frames:v", "1", "-update", "1", "-q:v", "2", tmpThumbPath)
	if out, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("ffmpeg thumbnail extraction failed: %w (output: %s)", err, string(out))
	}

	thumbFile, err := os.Open(tmpThumbPath)
	if err != nil {
		return nil, fmt.Errorf("opening extracted thumbnail: %w", err)
	}
	defer thumbFile.Close()

	return c.Upload(ctx, targetFolder, baseName+".jpg", thumbFile)
}

// GetVideoDuration uses ffprobe to get video duration in whole seconds.
func (c *Client) GetVideoDuration(ctx context.Context, videoFilePath string) (int, error) {
	cmd := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", videoFilePath)
	out, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("ffprobe failed: %w", err)
	}

	valStr := strings.TrimSpace(string(out))
	secFloat, err := strconv.ParseFloat(valStr, 64)
	if err != nil {
		return 0, fmt.Errorf("parse duration %q: %w", valStr, err)
	}

	durationSec := int(secFloat + 0.5)
	if durationSec <= 0 {
		durationSec = 1
	}
	return durationSec, nil
}
