package otelx

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"live-streaming-platform/internal/platform/config"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

func Setup(ctx context.Context, cfg config.Config, logger *slog.Logger) (func(context.Context) error, error) {
	if cfg.OTLPEndpoint == "" {
		return func(context.Context) error { return nil }, nil
	}

	exporter, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpoint(cfg.OTLPEndpoint),
		otlptracehttp.WithInsecure(),
	)
	if err != nil {
		return nil, fmt.Errorf("create otlp exporter: %w", err)
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(cfg.ServiceName),
			semconv.ServiceVersionKey.String(cfg.Version),
			attribute.String("deployment.environment.name", cfg.Environment),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("create resource: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter, sdktrace.WithBatchTimeout(3*time.Second)),
		sdktrace.WithResource(res),
	)

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	logger.Info("otel tracing configured", "endpoint", cfg.OTLPEndpoint)

	return tp.Shutdown, nil
}
