package redisx

import (
	"context"
	"crypto/tls"
	"fmt"

	"github.com/redis/go-redis/v9"
)

func NewClient(ctx context.Context, addr string, opts ...Option) (*redis.Client, error) {
	cfg := &options{}
	for _, o := range opts {
		o(cfg)
	}

	redisOpts := &redis.Options{
		Addr: addr,
	}

	if cfg.useTLS {
		redisOpts.TLSConfig = &tls.Config{
			MinVersion: tls.VersionTLS12,
		}
	}

	client := redis.NewClient(redisOpts)

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	return client, nil
}

type options struct {
	useTLS bool
}

type Option func(*options)

func WithTLS() Option {
	return func(o *options) {
		o.useTLS = true
	}
}
