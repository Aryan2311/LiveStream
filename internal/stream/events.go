package stream

import (
	"context"
	"encoding/json"
	"time"

	"github.com/nats-io/nats.go"
)

const LifecycleSubject = "stream.lifecycle"

type LifecycleEvent struct {
	StreamID   string    `json:"stream_id"`
	StreamKey  string    `json:"stream_key"`
	OwnerID    string    `json:"owner_id"`
	Status     Status    `json:"status"`
	OccurredAt time.Time `json:"occurred_at"`
}

func PublishLifecycle(ctx context.Context, conn *nats.Conn, item Stream) error {
	if conn == nil {
		return nil
	}

	payload, err := json.Marshal(LifecycleEvent{
		StreamID:   item.ID,
		StreamKey:  item.StreamKey,
		OwnerID:    item.OwnerID,
		Status:     item.Status,
		OccurredAt: time.Now().UTC(),
	})
	if err != nil {
		return err
	}

	msg := &nats.Msg{
		Subject: LifecycleSubject,
		Data:    payload,
	}

	return conn.PublishMsg(msg)
}
