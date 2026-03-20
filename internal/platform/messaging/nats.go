package messaging

import (
	"fmt"

	"github.com/nats-io/nats.go"
)

func Connect(url string) (*nats.Conn, error) {
	conn, err := nats.Connect(url, nats.Name("live-streaming-platform"))
	if err != nil {
		return nil, fmt.Errorf("connect nats: %w", err)
	}

	return conn, nil
}
