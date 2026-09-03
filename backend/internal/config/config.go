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

	// PaymentsEnforced gates the whole payment story. While false, an event
	// with a non-zero fee still registers normally (the computed amount is
	// recorded on the registration, but nothing collects it). Flipping this to
	// true makes those registrations return 402 instead.
	PaymentsEnforced bool

	UseEmulator bool
	GroqAPIKey string
}

func Load() (*Config, error) {
	loadDotEnv(".env")

	c := &Config{
		Port:            env("PORT", "6767"),
		ProjectID:       os.Getenv("FIREBASE_PROJECT_ID"),
		CredentialsFile: env("GOOGLE_APPLICATION_CREDENTIALS", "../serviceAccountKey.json"),
		QRSecret:        []byte(os.Getenv("QR_SIGNING_SECRET")),
		HostEmailDomain: strings.ToLower(env("HOST_EMAIL_DOMAIN", "thapar.edu")),
		AllowedOrigins:  splitCSV(env("ALLOWED_ORIGINS", "*")),
		RedisURL:        os.Getenv("REDIS_URL"),
		RedisNamespace:  env("REDIS_NAMESPACE", "sat26"),
		UseEmulator:     os.Getenv("FIRESTORE_EMULATOR_HOST") != "",
		GroqAPIKey: os.Getenv("GROQ_API_KEY"),
	}

	ttl, err := time.ParseDuration(env("EVENT_CACHE_TTL", "60s"))
	if err != nil {
		return nil, fmt.Errorf("EVENT_CACHE_TTL: %w", err)
	}
	c.EventCacheTTL = ttl

	if v := os.Getenv("PAYMENTS_ENFORCED"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return nil, fmt.Errorf("PAYMENTS_ENFORCED: %w", err)
		}
		c.PaymentsEnforced = b
	}

	if len(c.QRSecret) == 0 {
		return nil, fmt.Errorf("QR_SIGNING_SECRET is required")
	}
	if c.RedisURL == "" {
		return nil, fmt.Errorf("REDIS_URL is required")
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
