package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"live-streaming-platform/internal/platform/httpx"
	"live-streaming-platform/internal/platform/runtime"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	mux := http.NewServeMux()
	app, shutdownTelemetry, err := runtime.New(ctx, "api", mux)
	if err != nil {
		panic(err)
	}
	defer func() { _ = shutdownTelemetry(context.Background()) }()

	httpx.HandleSignals(cancel, app.Logger)

	authProxy := reverseProxy(app.Config.AuthServiceURL)
	streamProxy := reverseProxy(app.Config.StreamServiceURL)
	chatProxy := reverseProxy(app.Config.ChatServiceURL)
	hlsProxy := reverseProxy(app.Config.Media.HLSBaseURL)
	whipProxy := reverseProxy(app.Config.Media.WHIPBaseURL)
	frontendProxy := reverseProxy(app.Config.FrontendURL)

	mux.Handle("/auth/", http.StripPrefix("/auth", authProxy))
	mux.Handle("/public/streams/", streamProxy)
	mux.Handle("/public/streams", streamProxy)
	mux.Handle("/whip/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, PATCH, OPTIONS, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Expose-Headers", "Location, Link")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		http.StripPrefix("/whip", whipProxy).ServeHTTP(w, r)
	}))
	mux.Handle("/whep/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, PATCH, OPTIONS, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Expose-Headers", "Location, Link")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		http.StripPrefix("/whep", whipProxy).ServeHTTP(w, r)
	}))
	mux.Handle("/streams/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/messages") || strings.Contains(r.URL.Path, "/events") {
			chatProxy.ServeHTTP(w, r)
			return
		}

		streamProxy.ServeHTTP(w, r)
	}))
	mux.Handle("/streams", streamProxy)
	mux.Handle("/hls/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		streamKey := streamKeyFromPlaybackPath(strings.TrimPrefix(r.URL.Path, "/hls/"))
		if streamKey == "" {
			httpx.WriteJSON(w, http.StatusBadRequest, httpx.ErrorResponse{Error: "invalid playback path"})
			return
		}

		if strings.HasSuffix(r.URL.Path, ".m3u8") {
			if err := validatePlayback(app.Config.StreamServiceURL, streamKey, r.URL.Query().Get("expires"), r.URL.Query().Get("signature")); err != nil {
				httpx.WriteJSON(w, http.StatusUnauthorized, httpx.ErrorResponse{Error: err.Error()})
				return
			}
		}

		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.StripPrefix("/hls", hlsProxy).ServeHTTP(w, r)
	}))
	mux.Handle("/", frontendProxy)

	if err := app.Run(ctx); err != nil {
		panic(err)
	}
}

func reverseProxy(rawURL string) http.Handler {
	target, err := url.Parse(rawURL)
	if err != nil {
		panic(err)
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(r *http.Request) {
		originalDirector(r)
		r.Host = target.Host
	}

	return proxy
}

func validatePlayback(streamServiceURL, streamKey, expires, signature string) error {
	if expires == "" || signature == "" {
		return errors.New("missing playback signature")
	}

	target, err := url.Parse(streamServiceURL)
	if err != nil {
		return err
	}
	target.Path = "/playback/validate"

	query := target.Query()
	query.Set("stream_key", streamKey)
	query.Set("expires", expires)
	query.Set("signature", signature)
	target.RawQuery = query.Encode()

	req, err := http.NewRequest(http.MethodGet, target.String(), nil)
	if err != nil {
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return errors.New("playback URL rejected")
	}

	return nil
}

func streamKeyFromPlaybackPath(path string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 {
		return ""
	}

	return parts[0]
}
