package stream

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"live-streaming-platform/internal/platform/config"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("stream not found")

type Status string

const (
	StatusCreated Status = "created"
	StatusLive    Status = "live"
	StatusEnded   Status = "ended"
)

type Stream struct {
	ID                string    `json:"id"`
	Title             string    `json:"title"`
	Description       string    `json:"description"`
	StreamKey         string    `json:"stream_key"`
	OwnerID           string    `json:"owner_id"`
	Status            Status    `json:"status"`
	PlaybackURL       string    `json:"playback_url"`
	RTMPURL           string    `json:"rtmp_url"`
	WHIPURL           string    `json:"whip_url"`
	IngestCallbackURL string    `json:"ingest_callback_url,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type PublicStream struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      Status    `json:"status"`
	PlaybackURL string    `json:"playback_url"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Service struct {
	repo Repository
	cfg  config.MediaConfig
}

type Repository interface {
	Create(context.Context, Stream) error
	List(context.Context, string) ([]Stream, error)
	ListPublic(context.Context) ([]Stream, error)
	Get(context.Context, string) (Stream, error)
	GetPublic(context.Context, string) (Stream, error)
	GetByStreamKey(context.Context, string) (Stream, error)
	UpdateStatus(context.Context, string, Status) (Stream, error)
	Delete(context.Context, string) error
	CreateAsset(context.Context, Asset) error
	ListAssets(context.Context, string) ([]Asset, error)
}

func NewService(repo Repository, cfg config.MediaConfig) *Service {
	return &Service{
		repo: repo,
		cfg:  cfg,
	}
}

func (s *Service) Create(ctx context.Context, ownerID, title, description string) (Stream, error) {
	id := uuid.NewString()
	streamKey := strings.ReplaceAll(uuid.NewString(), "-", "")
	now := time.Now().UTC()

	stream := Stream{
		ID:                id,
		Title:             title,
		Description:       description,
		OwnerID:           ownerID,
		StreamKey:         streamKey,
		Status:            StatusCreated,
		PlaybackURL:       s.SignedPlaybackURL(streamKey),
		RTMPURL:           fmt.Sprintf("%s/%s/%s", strings.TrimRight(s.cfg.RTMPBaseURL, "/"), s.cfg.StreamAppName, streamKey),
		IngestCallbackURL: s.SignedIngestCallbackURL(streamKey),
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if err := s.repo.Create(ctx, stream); err != nil {
		return Stream{}, err
	}
	return s.hydrateStream(stream), nil
}

func (s *Service) List(ctx context.Context, ownerID string) ([]Stream, error) {
	streams, err := s.repo.List(ctx, ownerID)
	if err != nil {
		return nil, err
	}

	return s.hydrateStreams(streams), nil
}

func (s *Service) Get(ctx context.Context, id string) (Stream, error) {
	stream, err := s.repo.Get(ctx, id)
	if err != nil {
		return Stream{}, err
	}

	return s.hydrateStream(stream), nil
}

func (s *Service) ListPublic(ctx context.Context) ([]PublicStream, error) {
	streams, err := s.repo.ListPublic(ctx)
	if err != nil {
		return nil, err
	}

	publicStreams := make([]PublicStream, 0, len(streams))
	for _, item := range streams {
		publicStreams = append(publicStreams, s.toPublicStream(item))
	}

	return publicStreams, nil
}

func (s *Service) GetPublic(ctx context.Context, id string) (PublicStream, error) {
	stream, err := s.repo.GetPublic(ctx, id)
	if err != nil {
		return PublicStream{}, err
	}

	return s.toPublicStream(stream), nil
}

func (s *Service) MarkLive(ctx context.Context, id string) (Stream, error) {
	updated, err := s.repo.UpdateStatus(ctx, id, StatusLive)
	if err != nil {
		return Stream{}, err
	}

	return s.hydrateStream(updated), nil
}

func (s *Service) MarkLiveByKey(ctx context.Context, streamKey string) (Stream, error) {
	stream, err := s.repo.GetByStreamKey(ctx, streamKey)
	if err != nil {
		return Stream{}, err
	}

	updated, err := s.repo.UpdateStatus(ctx, stream.ID, StatusLive)
	if err != nil {
		return Stream{}, err
	}

	return s.hydrateStream(updated), nil
}

func (s *Service) End(ctx context.Context, id string) (Stream, error) {
	stream, err := s.repo.UpdateStatus(ctx, id, StatusEnded)
	if err != nil {
		return Stream{}, err
	}

	return s.hydrateStream(stream), nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *Service) ListAll(ctx context.Context, ownerID string, includeAll bool) ([]Stream, error) {
	var (
		streams []Stream
		err     error
	)

	if includeAll {
		streams, err = s.repo.List(ctx, "")
	} else {
		streams, err = s.repo.List(ctx, ownerID)
	}
	if err != nil {
		return nil, err
	}

	return s.hydrateStreams(streams), nil
}

func (s *Service) ListAssets(ctx context.Context, streamID string) ([]Asset, error) {
	return s.repo.ListAssets(ctx, streamID)
}

func (s *Service) RegisterAsset(ctx context.Context, asset Asset) error {
	return s.repo.CreateAsset(ctx, asset)
}

func (s *Service) SignedPlaybackURL(streamKey string) string {
	expires := time.Now().Add(s.cfg.PublishTTL).Unix()
	signature := sign(fmt.Sprintf("%s:%d", streamKey, expires), s.cfg.PlaybackSigningKey)
	base := strings.TrimRight(s.cfg.PublicBaseURL, "/")
	return fmt.Sprintf("%s/hls/%s/index.m3u8?expires=%d&signature=%s", base, streamKey, expires, signature)
}

func (s *Service) SignedIngestCallbackURL(streamKey string) string {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	signature := sign(streamKey+":"+timestamp, s.cfg.IngestSigningKey)
	base := strings.TrimRight(s.cfg.PublicBaseURL, "/")
	return fmt.Sprintf("%s/streams/live?stream_key=%s&timestamp=%s&signature=%s", base, streamKey, timestamp, signature)
}

func ValidatePlayback(streamKey, expires, signature, secret string) bool {
	expected := sign(fmt.Sprintf("%s:%s", streamKey, expires), secret)
	return hmac.Equal([]byte(expected), []byte(signature))
}

func ValidateIngest(streamKey, timestamp, signature, secret string, maxSkew time.Duration) bool {
	parsed, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return false
	}

	if skew := time.Since(time.Unix(parsed, 0)); skew > maxSkew || skew < -maxSkew {
		return false
	}

	expected := sign(streamKey+":"+timestamp, secret)
	return hmac.Equal([]byte(expected), []byte(signature))
}

func sign(payload, secret string) string {
	sum := hmac.New(sha256.New, []byte(secret))
	_, _ = sum.Write([]byte(payload))
	return hex.EncodeToString(sum.Sum(nil))
}

func (s *Service) hydrateStreams(items []Stream) []Stream {
	streams := make([]Stream, 0, len(items))
	for _, item := range items {
		streams = append(streams, s.hydrateStream(item))
	}

	return streams
}

func (s *Service) hydrateStream(item Stream) Stream {
	item.PlaybackURL = s.SignedPlaybackURL(item.StreamKey)
	item.RTMPURL = fmt.Sprintf("%s/%s/%s", strings.TrimRight(s.cfg.RTMPBaseURL, "/"), s.cfg.StreamAppName, item.StreamKey)
	item.WHIPURL = fmt.Sprintf("%s/%s/%s/whip", strings.TrimRight(s.cfg.WHIPBaseURL, "/"), s.cfg.StreamAppName, item.StreamKey)
	item.IngestCallbackURL = s.SignedIngestCallbackURL(item.StreamKey)
	return item
}

func (s *Service) toPublicStream(item Stream) PublicStream {
	item = s.hydrateStream(item)
	return PublicStream{
		ID:          item.ID,
		Title:       item.Title,
		Description: item.Description,
		Status:      item.Status,
		PlaybackURL: item.PlaybackURL,
		CreatedAt:   item.CreatedAt,
		UpdatedAt:   item.UpdatedAt,
	}
}
