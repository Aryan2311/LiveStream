package chat

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/redis/go-redis/v9"
)

type RedisRepository struct {
	client *redis.Client
}

func NewRedisRepository(client *redis.Client) *RedisRepository {
	return &RedisRepository{client: client}
}

func (r *RedisRepository) List(ctx context.Context, streamID string) ([]Message, error) {
	values, err := r.client.LRange(ctx, listKey(streamID), 0, -1).Result()
	if err != nil {
		return nil, err
	}

	messages := make([]Message, 0, len(values))
	for _, value := range values {
		var message Message
		if err := json.Unmarshal([]byte(value), &message); err != nil {
			return nil, err
		}
		messages = append(messages, message)
	}

	return messages, nil
}

func (r *RedisRepository) Add(ctx context.Context, message Message) error {
	payload, err := json.Marshal(message)
	if err != nil {
		return err
	}

	pipe := r.client.TxPipeline()
	pipe.RPush(ctx, listKey(message.StreamID), payload)
	pipe.LTrim(ctx, listKey(message.StreamID), -200, -1)
	pipe.Publish(ctx, channelKey(message.StreamID), payload)
	_, err = pipe.Exec(ctx)
	return err
}

func (r *RedisRepository) Subscribe(ctx context.Context, streamID string) (<-chan Message, func(), error) {
	pubsub := r.client.Subscribe(ctx, channelKey(streamID))
	if _, err := pubsub.Receive(ctx); err != nil {
		_ = pubsub.Close()
		return nil, nil, err
	}

	output := make(chan Message)
	go func() {
		defer close(output)
		defer pubsub.Close()

		ch := pubsub.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}

				var message Message
				if err := json.Unmarshal([]byte(msg.Payload), &message); err != nil {
					continue
				}

				select {
				case output <- message:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	cancel := func() {
		_ = pubsub.Close()
	}

	return output, cancel, nil
}

func listKey(streamID string) string {
	return fmt.Sprintf("chat:%s:messages", streamID)
}

func channelKey(streamID string) string {
	return fmt.Sprintf("chat:%s:events", streamID)
}
