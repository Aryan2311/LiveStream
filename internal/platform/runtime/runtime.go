package runtime

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"live-streaming-platform/internal/platform/config"
	"live-streaming-platform/internal/platform/httpx"
	"live-streaming-platform/internal/platform/logging"
	"live-streaming-platform/internal/platform/otelx"
)

type App struct {
	Config config.Config
	Logger *slog.Logger
	Server *httpx.Server
}

func New(ctx context.Context, service string, mux *http.ServeMux) (*App, func(context.Context) error, error) {
	cfg := config.Load(service)
	logger := logging.New(service, cfg.LogLevel)

	shutdownTelemetry, err := otelx.Setup(ctx, cfg, logger)
	if err != nil {
		return nil, nil, err
	}

	server := httpx.NewServer(cfg, logger, mux)
	httpx.AttachStandardRoutes(mux, server, cfg.ServiceName)

	return &App{
		Config: cfg,
		Logger: logger,
		Server: server,
	}, shutdownTelemetry, nil
}

func (a *App) Run(ctx context.Context) error {
	a.Server.MarkReady()

	errCh := make(chan error, 1)
	go func() {
		if err := a.Server.ListenAndServe(a.Logger); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		return a.Server.Shutdown(shutdownCtx)
	case err := <-errCh:
		return err
	}
}
