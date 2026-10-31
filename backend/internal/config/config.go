package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds every tunable the API needs. Load fails fast so a misconfigured
// deployment never boots half-working.
type Config struct {
	Port            string
	ProjectID       string
	CredentialsFile string
	QRSecret        []byte
	HostEmailDomain string
	AllowedOrigins  []string
	EventCacheTTL   time.Duration

	// RedisURL is required. The event cache keeps its shared snapshot and its
	// cross-instance invalidation channel there, so booting without it would
	// mean every instance silently serving its own stale view.
	RedisURL       string
	RedisNamespace string

	// PaymentsDummy turns on the mock checkout at /payments/dummy, which marks
	// any payment paid without touching the gateway. Local development only.
	PaymentsDummy bool

	// Easebuzz payment gateway credentials.
	// EasebuzzKey is the merchant key (public-facing, sent in the payment form).
	// EasebuzzSalt is the secret used only for hash generation, never sent to clients.
	// EasebuzzEnv is either "test" (staging) or "prod" (production).
	EasebuzzKey  string
	EasebuzzSalt string
	EasebuzzEnv  string // "test" | "prod"

	// AppBaseURL is the base URL of this API, used to construct surl/furl for Easebuzz.
	// e.g. "https://api.saturnalia.in"
	AppBaseURL string

	// FrontendDeepLinkBase is the custom scheme used to redirect the mobile app
	// after payment completes. e.g. "app://payment" (the app's scheme is "app")
	FrontendDeepLinkBase string

	// ImageKitAccountsFile points at the JSON array of ImageKit accounts that
	// internal/storage spreads uploads across. Optional: without it the API
	// still boots, and the upload endpoints answer storage_not_configured.
	ImageKitAccountsFile string

	UseEmulator bool
	GroqAPIKey  string
}

func Load() (*Config, error) {
	loadDotEnv(".env")

	c := &Config{
		Port:                 env("PORT", "6767"),
		ProjectID:            os.Getenv("FIREBASE_PROJECT_ID"),
		CredentialsFile:      env("GOOGLE_APPLICATION_CREDENTIALS", "../serviceAccountKey.json"),
		QRSecret:             []byte(os.Getenv("QR_SIGNING_SECRET")),
		HostEmailDomain:      strings.ToLower(env("HOST_EMAIL_DOMAIN", "thapar.edu")),
		AllowedOrigins:       splitCSV(env("ALLOWED_ORIGINS", "*")),
		RedisURL:             os.Getenv("REDIS_URL"),
		RedisNamespace:       env("REDIS_NAMESPACE", "sat26"),
		ImageKitAccountsFile: os.Getenv("IMAGEKIT_ACCOUNTS_FILE"),
		UseEmulator:          os.Getenv("FIRESTORE_EMULATOR_HOST") != "",
		GroqAPIKey:           env("GROQ_API_KEY", os.Getenv("GROQ_API_Key")),
		EasebuzzKey:          os.Getenv("EASEBUZZ_KEY"),
		EasebuzzSalt:         os.Getenv("EASEBUZZ_SALT"),
		EasebuzzEnv:          env("EASEBUZZ_ENV", "test"),
		AppBaseURL:           env("APP_BASE_URL", "http://localhost:6767"),
		FrontendDeepLinkBase: env("FRONTEND_DEEP_LINK_BASE", "app://payment"),
	}

	ttl, err := time.ParseDuration(env("EVENT_CACHE_TTL", "24h"))
	if err != nil {
		return nil, fmt.Errorf("EVENT_CACHE_TTL: %w", err)
	}
	c.EventCacheTTL = ttl

	if v := os.Getenv("PAYMENTS_DUMMY"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return nil, fmt.Errorf("PAYMENTS_DUMMY: %w", err)
		}
		c.PaymentsDummy = b
	}

	if c.PaymentsDummy && c.EasebuzzEnv == "prod" {
		return nil, fmt.Errorf("PAYMENTS_DUMMY must not be enabled with EASEBUZZ_ENV=prod")
	}

	if len(c.QRSecret) == 0 {
		return nil, fmt.Errorf("QR_SIGNING_SECRET is required")
	}
	if c.RedisURL == "" {
		return nil, fmt.Errorf("REDIS_URL is required")
	}
	// Checked only when set, so the file is required exactly when something
	// has been configured to use it.
	if c.ImageKitAccountsFile != "" {
		if _, err := os.Stat(c.ImageKitAccountsFile); err != nil {
			return nil, fmt.Errorf("imagekit accounts file %q not readable: %w", c.ImageKitAccountsFile, err)
		}
	}
	if !c.UseEmulator {
		if _, err := os.Stat(c.CredentialsFile); err != nil {
			return nil, fmt.Errorf("credentials file %q not readable: %w", c.CredentialsFile, err)
		}
	}

	return c, nil
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// loadDotEnv is a minimal .env reader so we don't take a dependency for it.
// Existing environment variables always win.
func loadDotEnv(path string) {
	b, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k, v = strings.TrimSpace(k), strings.TrimSpace(v)
		v = strings.Trim(v, `"'`)
		if _, exists := os.LookupEnv(k); !exists {
			os.Setenv(k, v)
		}
	}
}
