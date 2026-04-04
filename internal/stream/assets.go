package stream

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Asset struct {
	ID          string    `json:"id"`
	StreamID    string    `json:"stream_id"`
	OwnerID     string    `json:"owner_id"`
	AssetKind   string    `json:"asset_kind"`
	ObjectKey   string    `json:"object_key"`
	ContentType string    `json:"content_type"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

type AssetRepository interface {
	CreateAsset(context.Context, Asset) error
	ListAssets(context.Context, string) ([]Asset, error)
}

func NewAsset(streamID, ownerID, assetKind, objectKey, contentType string) Asset {
	return Asset{
		ID:          uuid.NewString(),
		StreamID:    streamID,
		OwnerID:     ownerID,
		AssetKind:   assetKind,
		ObjectKey:   objectKey,
		ContentType: contentType,
		Status:      "pending",
		CreatedAt:   time.Now().UTC(),
	}
}
