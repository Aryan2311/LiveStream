package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

const defaultVersion = "dev"

type Config struct {
	ServiceName string
	Version     string
	Environment string
	HTTPPort    int
	LogLevel    string

	AuthServiceURL   string
	StreamServiceURL string
	ChatServiceURL   string
	FrontendURL      string

	JWTSecret            string
	InternalServiceToken string
	BootstrapAdminEmails []string

	OTLPEndpoint string

	Postgres PostgresConfig
	Redis    RedisConfig
	NATS     NATSConfig
	Media    MediaConfig
	Storage  StorageConfig
}

type PostgresConfig struct {
	DSN string
}

type RedisConfig struct {
	Addr string
	TLS  bool
}

type NATSConfig struct {
	URL string
}

type MediaConfig struct {
	PublicBaseURL      string
	RTMPBaseURL        string
	HLSBaseURL         string
	WHIPBaseURL        string
	MediaMTXAPIURL     string
	StreamAppName      string
	PublishTTL         time.Duration
	PlaybackSigningKey string
	IngestSigningKey   string
	WebhookHeaderName  string
	WebhookClockSkew   time.Duration
}

type StorageConfig struct {
	Region          string
	Bucket          string
	Endpoint        string
	UsePathStyle    bool
	PublicBaseURL   string
	UploadURLExpiry time.Duration
}

func Load(serviceName string) Config {
	port := mustInt(envOrDefault("HTTP_PORT", "8080"))

	cfg := Config{
		ServiceName:          serviceName,
		Version:              envOrDefault("APP_VERSION", defaultVersion),
		Environment:          envOrDefault("APP_ENV", "development"),
		HTTPPort:             port,
		LogLevel:             strings.ToLower(envOrDefault("LOG_LEVEL", "info")),
		AuthServiceURL:       envOrDefault("AUTH_SERVICE_URL", "http://auth-service:8081"),
		StreamServiceURL:     envOrDefault("STREAM_SERVICE_URL", "http://stream-service:8082"),
		ChatServiceURL:       envOrDefault("CHAT_SERVICE_URL", "http://chat-service:8083"),
		FrontendURL:          envOrDefault("FRONTEND_URL", "http://frontend:3000"),
		JWTSecret:            envOrDefault("JWT_SECRET", "change-me"),
		InternalServiceToken: envOrDefault("INTERNAL_SERVICE_TOKEN", "internal-change-me"),
		BootstrapAdminEmails: splitCSVEnv("BOOTSTRAP_ADMIN_EMAILS"),
		OTLPEndpoint:         os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"),
		Postgres: PostgresConfig{
			DSN: envOrDefault("POSTGRES_DSN", "postgres://postgres:postgres@postgres:5432/live?sslmode=disable"),
		},
		Redis: RedisConfig{
			Addr: envOrDefault("REDIS_ADDR", "redis:6379"),
			TLS:  mustBool(envOrDefault("REDIS_TLS", "false")),
		},
		NATS: NATSConfig{
			URL: envOrDefault("NATS_URL", "nats://nats:4222"),
		},
		Media: MediaConfig{
			PublicBaseURL:      envOrDefault("PUBLIC_BASE_URL", "http://localhost:8080"),
			RTMPBaseURL:        envOrDefault("RTMP_BASE_URL", "rtmp://localhost:1935"),
			HLSBaseURL:         envOrDefault("HLS_BASE_URL", "http://localhost:8888"),
			WHIPBaseURL:        envOrDefault("WHIP_BASE_URL", "http://localhost:8889"),
			MediaMTXAPIURL:     strings.TrimSpace(os.Getenv("MEDIAMTX_API_URL")),
			StreamAppName:      envOrDefault("STREAM_APP_NAME", "live"),
			PublishTTL:         mustDuration(envOrDefault("STREAM_PUBLISH_TTL", "24h")),
			PlaybackSigningKey: envOrDefault("PLAYBACK_SIGNING_KEY", "playback-change-me"),
			IngestSigningKey:   envOrDefault("INGEST_SIGNING_KEY", "ingest-change-me"),
			WebhookHeaderName:  envOrDefault("MEDIA_WEBHOOK_HEADER_NAME", "X-Internal-Service-Token"),
			WebhookClockSkew:   mustDuration(envOrDefault("MEDIA_WEBHOOK_CLOCK_SKEW", "5m")),
		},
		Storage: StorageConfig{
			Region:          envOrDefault("AWS_REGION", "us-east-1"),
			Bucket:          envOrDefault("MEDIA_BUCKET_NAME", "live-dev-media-artifacts"),
			Endpoint:        strings.TrimSpace(os.Getenv("S3_ENDPOINT")),
			UsePathStyle:    mustBool(envOrDefault("S3_USE_PATH_STYLE", "false")),
			PublicBaseURL:   envOrDefault("ASSET_PUBLIC_BASE_URL", ""),
			UploadURLExpiry: mustDuration(envOrDefault("UPLOAD_URL_EXPIRY", "15m")),
		},
	}

	return cfg
}

func (c Config) HTTPAddress() string {
	return fmt.Sprintf(":%d", c.HTTPPort)
}

func envOrDefault(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	return value
}

func mustInt(value string) int {
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 8080
	}

	return parsed
}

func mustDuration(value string) time.Duration {
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 24 * time.Hour
	}

	return parsed
}

func mustBool(value string) bool {
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false
	}

	return parsed
}

func splitCSVEnv(key string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return nil
	}

	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(strings.ToLower(part))
		if item != "" {
			out = append(out, item)
		}
	}

	return out
}
