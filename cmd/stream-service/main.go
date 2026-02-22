package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"live-streaming-platform/internal/auth"
	"live-streaming-platform/internal/mediamtx"
	"live-streaming-platform/internal/platform/httpx"
	"live-streaming-platform/internal/platform/messaging"
	"live-streaming-platform/internal/platform/postgres"
	"live-streaming-platform/internal/platform/runtime"
	"live-streaming-platform/internal/storage"
	"live-streaming-platform/internal/stream"
)

type createStreamRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type createAssetUploadRequest struct {
	AssetKind   string `json:"asset_kind"`
	FileName    string `json:"file_name"`
	ContentType string `json:"content_type"`
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	mux := http.NewServeMux()
	app, shutdownTelemetry, err := runtime.New(ctx, "stream-service", mux)
	if err != nil {
		panic(err)
	}
	defer func() { _ = shutdownTelemetry(context.Background()) }()

	httpx.HandleSignals(cancel, app.Logger)

	db, err := postgres.Open(ctx, app.Config.Postgres.DSN)
	if err != nil {
		panic(err)
	}
	defer db.Close()

	if err := postgres.RunMigrations(ctx, db); err != nil {
		panic(err)
	}

	natsConn, err := messaging.Connect(app.Config.NATS.URL)
	if err != nil {
		panic(err)
	}
	defer natsConn.Close()

	repo := stream.NewPostgresRepository(db)
	service := stream.NewService(repo, app.Config.Media)

	presigner, err := storage.NewPresigner(ctx, app.Config.Storage)
	if err != nil {
		panic(err)
	}

	mux.HandleFunc("GET /public/streams", func(w http.ResponseWriter, r *http.Request) {
		streams, err := service.ListPublic(r.Context())
		if err != nil {
			httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"streams": streams,
		})
	})

	mux.HandleFunc("GET /public/streams/{id}", func(w http.ResponseWriter, r *http.Request) {
		item, err := service.GetPublic(r.Context(), r.PathValue("id"))
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, stream.ErrNotFound) {
				status = http.StatusNotFound
			}

			httpx.WriteJSON(w, status, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		httpx.WriteJSON(w, http.StatusOK, item)
	})

	mux.Handle("/streams", auth.Middleware(app.Config.JWTSecret, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			httpx.WriteJSON(w, http.StatusUnauthorized, httpx.ErrorResponse{Error: auth.ErrUnauthorized.Error()})
			return
		}

		switch r.Method {
		case http.MethodGet:
			includeAll := user.Role == "admin" || user.Role == "moderator"
			streams, err := service.ListAll(r.Context(), user.ID, includeAll)
			if err != nil {
				httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
				return
			}

			httpx.WriteJSON(w, http.StatusOK, map[string]any{
				"streams": streams,
			})
		case http.MethodPost:
			var req createStreamRequest
			if err := httpx.ReadJSON(r, &req); err != nil {
				httpx.WriteJSON(w, http.StatusBadRequest, httpx.ErrorResponse{Error: err.Error()})
				return
			}

			item, err := service.Create(r.Context(), user.ID, req.Title, req.Description)
			if err != nil {
				httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
				return
			}

			_ = stream.PublishLifecycle(r.Context(), natsConn, item)
			httpx.WriteJSON(w, http.StatusCreated, item)
		default:
			http.NotFound(w, r)
		}
	})))

mux.Handle("/streams/", auth.Middleware(app.Config.JWTSecret, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/streams/end/") || strings.HasPrefix(r.URL.Path, "/streams/delete/") {
		http.NotFound(w, r)
		return
	}

	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteJSON(w, http.StatusUnauthorized, httpx.ErrorResponse{Error: auth.ErrUnauthorized.Error()})
		return
	}

	relativePath := strings.TrimPrefix(r.URL.Path, "/streams/")
	if strings.HasSuffix(relativePath, "/assets") {
		streamID := strings.TrimSuffix(relativePath, "/assets")
		item, err := service.Get(r.Context(), streamID)
		if err != nil {
			httpx.WriteJSON(w, http.StatusNotFound, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		if item.OwnerID != user.ID && user.Role != "admin" && user.Role != "moderator" {
			httpx.WriteJSON(w, http.StatusForbidden, httpx.ErrorResponse{Error: "stream not owned by user"})
			return
		}

		switch r.Method {
		case http.MethodGet:
			assets, err := service.ListAssets(r.Context(), streamID)
			if err != nil {
				httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
				return
			}

			httpx.WriteJSON(w, http.StatusOK, map[string]any{"assets": assets})
		case http.MethodPost:
			var req createAssetUploadRequest
			if err := httpx.ReadJSON(r, &req); err != nil {
				httpx.WriteJSON(w, http.StatusBadRequest, httpx.ErrorResponse{Error: err.Error()})
				return
			}

			objectKey := fmt.Sprintf("streams/%s/assets/%d-%s", streamID, time.Now().Unix(), sanitizeFileName(req.FileName))
			asset := stream.NewAsset(streamID, item.OwnerID, req.AssetKind, objectKey, req.ContentType)
			if err := service.RegisterAsset(r.Context(), asset); err != nil {
				httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
				return
			}

			target, err := presigner.PresignPutObject(r.Context(), objectKey, req.ContentType)
			if err != nil {
				httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
				return
			}

			httpx.WriteJSON(w, http.StatusCreated, map[string]any{
				"asset":         asset,
				"upload_target": target,
			})
		default:
			http.NotFound(w, r)
		}

		return
	}

	item, err := service.Get(r.Context(), relativePath)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, stream.ErrNotFound) {
			status = http.StatusNotFound
		}

		httpx.WriteJSON(w, status, httpx.ErrorResponse{Error: err.Error()})
		return
	}

	if item.OwnerID != user.ID && user.Role != "admin" && user.Role != "moderator" {
		httpx.WriteJSON(w, http.StatusForbidden, httpx.ErrorResponse{Error: "stream not owned by user"})
		return
	}

	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, item)
})))

	mux.HandleFunc("POST /streams/live", func(w http.ResponseWriter, r *http.Request) {
		streamKey := r.URL.Query().Get("stream_key")
		timestamp := r.URL.Query().Get("timestamp")
		signature := r.URL.Query().Get("signature")
		internalToken := strings.TrimSpace(r.Header.Get(app.Config.Media.WebhookHeaderName))
		if internalToken == "" || internalToken != app.Config.InternalServiceToken {
			httpx.WriteJSON(w, http.StatusUnauthorized, httpx.ErrorResponse{Error: "invalid webhook token"})
			return
		}

		if streamKey == "" || !stream.ValidateIngest(streamKey, timestamp, signature, app.Config.Media.IngestSigningKey, app.Config.Media.WebhookClockSkew) {
			httpx.WriteJSON(w, http.StatusUnauthorized, httpx.ErrorResponse{Error: "invalid ingest signature"})
			return
		}

		item, err := service.MarkLiveByKey(r.Context(), streamKey)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, stream.ErrNotFound) {
				status = http.StatusNotFound
			}

			httpx.WriteJSON(w, status, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		_ = stream.PublishLifecycle(r.Context(), natsConn, item)
		httpx.WriteJSON(w, http.StatusOK, item)
	})

	mux.Handle("/streams/go-live/", auth.Middleware(app.Config.JWTSecret, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}

		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			httpx.WriteJSON(w, http.StatusUnauthorized, httpx.ErrorResponse{Error: auth.ErrUnauthorized.Error()})
			return
		}

		id := strings.TrimPrefix(r.URL.Path, "/streams/go-live/")
		current, err := service.Get(r.Context(), id)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, stream.ErrNotFound) {
				status = http.StatusNotFound
			}

			httpx.WriteJSON(w, status, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		if current.OwnerID != user.ID && user.Role != "admin" && user.Role != "moderator" {
			httpx.WriteJSON(w, http.StatusForbidden, httpx.ErrorResponse{Error: "stream not owned by user"})
			return
		}

		item, err := service.MarkLive(r.Context(), id)
		if err != nil {
			httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		_ = stream.PublishLifecycle(r.Context(), natsConn, item)
		httpx.WriteJSON(w, http.StatusOK, item)
	})))

	mux.Handle("/streams/end/", auth.Middleware(app.Config.JWTSecret, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}

		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			httpx.WriteJSON(w, http.StatusUnauthorized, httpx.ErrorResponse{Error: auth.ErrUnauthorized.Error()})
			return
		}

		id := strings.TrimPrefix(r.URL.Path, "/streams/end/")
		current, err := service.Get(r.Context(), id)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, stream.ErrNotFound) {
				status = http.StatusNotFound
			}

			httpx.WriteJSON(w, status, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		if current.OwnerID != user.ID && user.Role != "admin" && user.Role != "moderator" {
			httpx.WriteJSON(w, http.StatusForbidden, httpx.ErrorResponse{Error: "stream not owned by user"})
			return
		}

		item, err := service.End(r.Context(), id)
		if err != nil {
			httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		_ = stream.PublishLifecycle(r.Context(), natsConn, item)
		httpx.WriteJSON(w, http.StatusOK, item)
	})))

	mux.Handle("/streams/delete/", auth.Middleware(app.Config.JWTSecret, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost && r.Method != http.MethodDelete {
			http.NotFound(w, r)
			return
		}

		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			httpx.WriteJSON(w, http.StatusUnauthorized, httpx.ErrorResponse{Error: auth.ErrUnauthorized.Error()})
			return
		}

		id := strings.TrimPrefix(r.URL.Path, "/streams/delete/")
		current, err := service.Get(r.Context(), id)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, stream.ErrNotFound) {
				status = http.StatusNotFound
			}

			httpx.WriteJSON(w, status, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		if current.OwnerID != user.ID && user.Role != "admin" && user.Role != "moderator" {
			httpx.WriteJSON(w, http.StatusForbidden, httpx.ErrorResponse{Error: "stream not owned by user"})
			return
		}

		if err := service.Delete(r.Context(), id); err != nil {
			httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})))

	mux.HandleFunc("GET /playback/validate", func(w http.ResponseWriter, r *http.Request) {
		streamKey := strings.TrimSpace(r.URL.Query().Get("stream_key"))
		expires := strings.TrimSpace(r.URL.Query().Get("expires"))
		signature := strings.TrimSpace(r.URL.Query().Get("signature"))
		if streamKey == "" || expires == "" || signature == "" {
			httpx.WriteJSON(w, http.StatusBadRequest, httpx.ErrorResponse{Error: "missing playback signature parameters"})
			return
		}

		expiryUnix, err := strconv.ParseInt(expires, 10, 64)
		if err != nil || time.Now().Unix() > expiryUnix {
			httpx.WriteJSON(w, http.StatusUnauthorized, httpx.ErrorResponse{Error: "playback URL expired"})
			return
		}

		if !stream.ValidatePlayback(streamKey, expires, signature, app.Config.Media.PlaybackSigningKey) {
			httpx.WriteJSON(w, http.StatusUnauthorized, httpx.ErrorResponse{Error: "invalid playback signature"})
			return
		}

		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	if app.Config.Media.MediaMTXAPIURL != "" {
		mtxClient := mediamtx.NewClient(app.Config.Media.MediaMTXAPIURL)
		go func() {
			ticker := time.NewTicker(3 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					func() {
						syncCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
						defer cancel()
						paths, err := mtxClient.PublisherPathNames(syncCtx)
						if err != nil {
							app.Logger.Debug("mediamtx ingest sync: list paths failed", "err", err)
							return
						}
						streams, err := service.List(syncCtx, "")
						if err != nil {
							app.Logger.Debug("mediamtx ingest sync: list streams failed", "err", err)
							return
						}
						appName := app.Config.Media.StreamAppName
						for _, st := range streams {
							if st.Status != stream.StatusCreated {
								continue
							}
							pathName := appName + "/" + st.StreamKey
							if _, ok := paths[pathName]; !ok {
								continue
							}
							updated, err := service.MarkLiveByKey(syncCtx, st.StreamKey)
							if err != nil {
								continue
							}
							_ = stream.PublishLifecycle(syncCtx, natsConn, updated)
						}
					}()
				}
			}
		}()
	}

	if err := app.Run(ctx); err != nil {
		panic(err)
	}
}

func sanitizeFileName(name string) string {
	name = strings.TrimSpace(name)
	name = strings.ReplaceAll(name, " ", "-")
	name = strings.ReplaceAll(name, "/", "-")
	if name == "" {
		return "asset.bin"
	}

	return name
}
