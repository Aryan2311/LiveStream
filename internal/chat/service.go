package chat

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Message struct {
	ID        string    `json:"id"`
	StreamID  string    `json:"stream_id"`
	UserID    string    `json:"user_id"`
	Author    string    `json:"author"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}

type Service struct {
	repo Repository
}

type Repository interface {
	List(context.Context, string) ([]Message, error)
	Add(context.Context, Message) error
	Subscribe(context.Context, string) (<-chan Message, func(), error)
}

func NewService(repo Repository) *Service {
	return &Service{
		repo: repo,
	}
}

func (s *Service) List(ctx context.Context, streamID string) ([]Message, error) {
	return s.repo.List(ctx, streamID)
}

func (s *Service) Add(ctx context.Context, streamID, userID, author, body string) (Message, error) {
	message := Message{
		ID:        uuid.NewString(),
		StreamID:  streamID,
		UserID:    userID,
		Author:    author,
		Body:      body,
		CreatedAt: time.Now().UTC(),
	}

	if err := s.repo.Add(ctx, message); err != nil {
		return Message{}, err
	}

	return message, nil
}

func (s *Service) Subscribe(ctx context.Context, streamID string) (<-chan Message, func(), error) {
	return s.repo.Subscribe(ctx, streamID)
}
