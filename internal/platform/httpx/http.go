package httpx

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"live-streaming-platform/internal/platform/config"
	"live-streaming-platform/internal/platform/logging"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type Server struct {
	httpServer *http.Server
	ready      atomic.Bool
}

type ErrorResponse struct {
	Error string `json:"error"`
}

var requestsTotal = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total HTTP requests handled by the service.",
	},
	[]string{"service", "method", "path", "status"},
)

var requestDuration = prometheus.NewHistogramVec(
	prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request durations.",
		Buckets: prometheus.DefBuckets,
	},
	[]string{"service", "method", "path"},
)

func init() {
	prometheus.MustRegister(requestsTotal, requestDuration)
}

func NewServer(cfg config.Config, logger *slog.Logger, handler http.Handler) *Server {
	return &Server{
		httpServer: &http.Server{
			Addr:              cfg.HTTPAddress(),
			Handler:           middleware(cfg.ServiceName, logger, handler),
			ReadHeaderTimeout: 10 * time.Second,
		},
	}
}

func (s *Server) MarkReady() {
	s.ready.Store(true)
}

func (s *Server) Ready() bool {
	return s.ready.Load()
}

func (s *Server) ListenAndServe(logger *slog.Logger) error {
	logger.Info("starting http server", "address", s.httpServer.Addr)
	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}

func HandleSignals(cancel context.CancelFunc, logger *slog.Logger) {
	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, os.Interrupt, syscall.SIGTERM)

	go func() {
		sig := <-signalCh
		logger.Info("received shutdown signal", "signal", sig.String())
		cancel()
	}()
}

func AttachStandardRoutes(mux *http.ServeMux, server *Server, service string) {
	mux.Handle("GET /metrics", promhttp.Handler())
	mux.HandleFunc("GET /livez", func(w http.ResponseWriter, _ *http.Request) {
		WriteJSON(w, http.StatusOK, map[string]string{
			"status":  "ok",
			"service": service,
		})
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, _ *http.Request) {
		if !server.Ready() {
			WriteJSON(w, http.StatusServiceUnavailable, ErrorResponse{Error: "service not ready"})
			return
		}

		WriteJSON(w, http.StatusOK, map[string]string{
			"status":  "ready",
			"service": service,
		})
	})
}

func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func ReadJSON(r *http.Request, payload any) error {
	return json.NewDecoder(r.Body).Decode(payload)
}

func middleware(service string, logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.NewString()
		}

		ctx := logging.WithRequestID(r.Context(), requestID)
		r = r.WithContext(ctx)

		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()
		next.ServeHTTP(recorder, r)

		path := normalizePath(r.URL.Path)
		duration := time.Since(start).Seconds()
		requestsTotal.WithLabelValues(service, r.Method, path, fmt.Sprintf("%d", recorder.status)).Inc()
		requestDuration.WithLabelValues(service, r.Method, path).Observe(duration)

		logging.FromContext(ctx, logger).Info("request handled",
			"method", r.Method,
			"path", r.URL.Path,
			"status", recorder.status,
			"duration_seconds", duration,
		)
	})
}

func normalizePath(path string) string {
	if path == "" {
		return "/"
	}

	if strings.HasPrefix(path, "/streams/") {
		return "/streams/:id"
	}

	return path
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Flush() {
	if flusher, ok := r.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (r *statusRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := r.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("response writer does not support hijacking")
	}

	return hijacker.Hijack()
}

func (r *statusRecorder) ReadFrom(src io.Reader) (int64, error) {
	if readerFrom, ok := r.ResponseWriter.(io.ReaderFrom); ok {
		return readerFrom.ReadFrom(src)
	}

	return io.Copy(r.ResponseWriter, src)
}
