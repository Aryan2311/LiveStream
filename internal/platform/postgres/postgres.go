package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func Open(ctx context.Context, dsn string) (*sql.DB, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(10)
	db.SetConnMaxIdleTime(5 * time.Minute)
	db.SetConnMaxLifetime(30 * time.Minute)

	deadline := time.Now().Add(45 * time.Second)
	for {
		pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err = db.PingContext(pingCtx)
		cancel()
		if err == nil {
			break
		}

		if ctx.Err() != nil {
			_ = db.Close()
			return nil, fmt.Errorf("ping postgres: %w", ctx.Err())
		}

		if time.Now().After(deadline) {
			_ = db.Close()
			return nil, fmt.Errorf("ping postgres after retries: %w", err)
		}

		time.Sleep(2 * time.Second)
	}

	return db, nil
}
