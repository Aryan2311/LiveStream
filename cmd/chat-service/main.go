package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"live-streaming-platform/internal/auth"
	"live-streaming-platform/internal/chat"
	"live-streaming-platform/internal/platform/httpx"
	"live-streaming-platform/internal/platform/messaging"
	"live-streaming-platform/internal/platform/redisx"
	"live-streaming-platform/internal/platform/runtime"
	"live-streaming-platform/internal/stream"

	"github.com/nats-io/nats.go"
)

type createMessageRequest struct {
	UserID string `json:"user_id"`
	Author string `json:"author"`
	Body   string `json:"body"`
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	mux := http.NewServeMux()
	app, shutdownTelemetry, err := runtime.New(ctx, "chat-service", mux)
	if err != nil {
		panic(err)
	}
	defer func() { _ = shutdownTelemetry(context.Background()) }()

	httpx.HandleSignals(cancel, app.Logger)

	var redisOpts []redisx.Option
	if app.Config.Redis.TLS {
		redisOpts = append(redisOpts, redisx.WithTLS())
	}
	redisClient, err := redisx.NewClient(ctx, app.Config.Redis.Addr, redisOpts...)
	if err != nil {
		panic(err)
	}
	defer redisClient.Close()

	natsConn, err := messaging.Connect(app.Config.NATS.URL)
	if err != nil {
		panic(err)
	}
	defer natsConn.Close()

	service := chat.NewService(chat.NewRedisRepository(redisClient))

	_, err = natsConn.Subscribe(stream.LifecycleSubject, func(msg *nats.Msg) {
		var event stream.LifecycleEvent
		if err := json.Unmarshal(msg.Data, &event); err != nil {
			return
		}

		body := fmt.Sprintf("stream status changed to %s", event.Status)
		_, _ = service.Add(context.Background(), event.StreamID, "system", "system", body)
	})
	if err != nil {
		panic(err)
	}

	mux.HandleFunc("/streams/", func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/messages"):
			streamID := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/streams/"), "/messages")
			messages, err := service.List(r.Context(), streamID)
			if err != nil {
				httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
				return
			}
			httpx.WriteJSON(w, http.StatusOK, map[string]any{
				"messages": messages,
			})
		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/messages"):
			auth.Middleware(app.Config.JWTSecret, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				streamID := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/streams/"), "/messages")

				user, ok := auth.UserFromContext(r.Context())
				if !ok {
					httpx.WriteJSON(w, http.StatusUnauthorized, httpx.ErrorResponse{Error: auth.ErrUnauthorized.Error()})
					return
				}

				var req createMessageRequest
				if err := httpx.ReadJSON(r, &req); err != nil {
					httpx.WriteJSON(w, http.StatusBadRequest, httpx.ErrorResponse{Error: err.Error()})
					return
				}

				author := req.Author
				if author == "" {
					author = user.DisplayName
				}

				message, err := service.Add(r.Context(), streamID, user.ID, author, req.Body)
				if err != nil {
					httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
					return
				}

				httpx.WriteJSON(w, http.StatusCreated, message)
			})).ServeHTTP(w, r)
		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/events"):
			streamID := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/streams/"), "/events")
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")
			flusher, ok := w.(http.Flusher)
			if !ok {
				http.Error(w, "streaming unsupported", http.StatusInternalServerError)
				return
			}

			messages, err := service.List(r.Context(), streamID)
			if err != nil {
				httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
				return
			}

			for _, message := range messages {
				fmt.Fprintf(w, "data: %s: %s\n\n", message.Author, message.Body)
			}
			flusher.Flush()

			streamCtx, cancel := context.WithCancel(r.Context())
			defer cancel()

			events, unsubscribe, err := service.Subscribe(streamCtx, streamID)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			defer unsubscribe()

			for {
				select {
				case <-r.Context().Done():
					return
				case event, ok := <-events:
					if !ok {
						return
					}
					fmt.Fprintf(w, "data: %s: %s\n\n", event.Author, event.Body)
					flusher.Flush()
				}
			}
		default:
			http.NotFound(w, r)
		}
	})

	if err := app.Run(ctx); err != nil {
		panic(err)
	}
}
