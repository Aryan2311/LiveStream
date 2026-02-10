package main

import (
	"context"

	"live-streaming-platform/internal/platform/config"
	"live-streaming-platform/internal/platform/logging"
	"live-streaming-platform/internal/platform/postgres"
)

func main() {
	ctx := context.Background()
	cfg := config.Load("migrate")
	logger := logging.New("migrate", cfg.LogLevel)

	db, err := postgres.Open(ctx, cfg.Postgres.DSN)
	if err != nil {
		panic(err)
	}
	defer db.Close()

	if err := postgres.RunMigrations(ctx, db); err != nil {
		panic(err)
	}

	logger.Info("database migrations completed")
}
