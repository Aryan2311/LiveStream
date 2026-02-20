package stream

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) Create(ctx context.Context, stream Stream) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO streams (
			id, title, description, stream_key, owner_id, status, playback_url, rtmp_url, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, stream.ID, stream.Title, stream.Description, stream.StreamKey, stream.OwnerID, stream.Status, stream.PlaybackURL, stream.RTMPURL, stream.CreatedAt, stream.UpdatedAt)
	return err
}

func (r *PostgresRepository) List(ctx context.Context, ownerID string) ([]Stream, error) {
	query := `
		SELECT id, title, description, stream_key, owner_id, status, playback_url, rtmp_url, created_at, updated_at
		FROM streams
	`
	var rows *sql.Rows
	var err error
	if ownerID == "" {
		query += " ORDER BY created_at DESC"
		rows, err = r.db.QueryContext(ctx, query)
	} else {
		query += " WHERE owner_id = $1 ORDER BY created_at DESC"
		rows, err = r.db.QueryContext(ctx, query, ownerID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var streams []Stream
	for rows.Next() {
		item, err := scanStream(rows)
		if err != nil {
			return nil, err
		}
		streams = append(streams, item)
	}

	return streams, rows.Err()
}

func (r *PostgresRepository) ListPublic(ctx context.Context) ([]Stream, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, title, description, stream_key, owner_id, status, playback_url, rtmp_url, created_at, updated_at
		FROM streams
		WHERE status = $1
		ORDER BY updated_at DESC, created_at DESC
	`, StatusLive)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var streams []Stream
	for rows.Next() {
		item, err := scanStream(rows)
		if err != nil {
			return nil, err
		}
		streams = append(streams, item)
	}

	return streams, rows.Err()
}

func (r *PostgresRepository) Get(ctx context.Context, id string) (Stream, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, title, description, stream_key, owner_id, status, playback_url, rtmp_url, created_at, updated_at
		FROM streams
		WHERE id = $1
	`, id)

	stream, err := scanStream(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Stream{}, ErrNotFound
	}
	return stream, err
}

func (r *PostgresRepository) GetPublic(ctx context.Context, id string) (Stream, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, title, description, stream_key, owner_id, status, playback_url, rtmp_url, created_at, updated_at
		FROM streams
		WHERE id = $1
	`, id)

	stream, err := scanStream(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Stream{}, ErrNotFound
	}
	return stream, err
}

func (r *PostgresRepository) GetByStreamKey(ctx context.Context, streamKey string) (Stream, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, title, description, stream_key, owner_id, status, playback_url, rtmp_url, created_at, updated_at
		FROM streams
		WHERE stream_key = $1
	`, streamKey)

	stream, err := scanStream(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Stream{}, ErrNotFound
	}
	return stream, err
}

func (r *PostgresRepository) UpdateStatus(ctx context.Context, id string, status Status) (Stream, error) {
	now := time.Now().UTC()
	row := r.db.QueryRowContext(ctx, `
		UPDATE streams
		SET status = $2, updated_at = $3
		WHERE id = $1
		RETURNING id, title, description, stream_key, owner_id, status, playback_url, rtmp_url, created_at, updated_at
	`, id, status, now)

	stream, err := scanStream(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Stream{}, ErrNotFound
	}
	return stream, err
}

func (r *PostgresRepository) Delete(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM streams WHERE id = $1`, id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *PostgresRepository) CreateAsset(ctx context.Context, asset Asset) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO stream_assets (
			id, stream_id, owner_id, asset_kind, object_key, content_type, status, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, asset.ID, asset.StreamID, asset.OwnerID, asset.AssetKind, asset.ObjectKey, asset.ContentType, asset.Status, asset.CreatedAt)
	return err
}

func (r *PostgresRepository) ListAssets(ctx context.Context, streamID string) ([]Asset, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, stream_id, owner_id, asset_kind, object_key, content_type, status, created_at
		FROM stream_assets
		WHERE stream_id = $1
		ORDER BY created_at DESC
	`, streamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assets []Asset
	for rows.Next() {
		var asset Asset
		if err := rows.Scan(
			&asset.ID,
			&asset.StreamID,
			&asset.OwnerID,
			&asset.AssetKind,
			&asset.ObjectKey,
			&asset.ContentType,
			&asset.Status,
			&asset.CreatedAt,
		); err != nil {
			return nil, err
		}
		assets = append(assets, asset)
	}

	return assets, rows.Err()
}

type streamScanner interface {
	Scan(dest ...any) error
}

func scanStream(row streamScanner) (Stream, error) {
	var item Stream
	err := row.Scan(
		&item.ID,
		&item.Title,
		&item.Description,
		&item.StreamKey,
		&item.OwnerID,
		&item.Status,
		&item.PlaybackURL,
		&item.RTMPURL,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	return item, err
}
