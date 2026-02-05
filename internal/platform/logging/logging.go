package logging

import (
	"context"
	"log/slog"
	"os"
)

type ctxKey string

const requestIDKey ctxKey = "request_id"

func New(service, level string) *slog.Logger {
	logLevel := new(slog.LevelVar)
	logLevel.Set(parseLevel(level))

	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	})).With("service", service)
}

func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, requestIDKey, requestID)
}

func FromContext(ctx context.Context, logger *slog.Logger) *slog.Logger {
	if requestID, ok := ctx.Value(requestIDKey).(string); ok && requestID != "" {
		return logger.With("request_id", requestID)
	}

	return logger
}

func parseLevel(level string) slog.Level {
	switch level {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
