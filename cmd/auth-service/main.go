package main

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"live-streaming-platform/internal/auth"
	"live-streaming-platform/internal/platform/httpx"
	"live-streaming-platform/internal/platform/postgres"
	"live-streaming-platform/internal/platform/runtime"
)

type registerRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type updateRoleRequest struct {
	Role string `json:"role"`
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	mux := http.NewServeMux()
	app, shutdownTelemetry, err := runtime.New(ctx, "auth-service", mux)
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

	service := auth.NewService(app.Config.JWTSecret, auth.NewPostgresRepository(db))

	mux.HandleFunc("POST /register", func(w http.ResponseWriter, r *http.Request) {
		var req registerRequest
		if err := httpx.ReadJSON(r, &req); err != nil {
			httpx.WriteJSON(w, http.StatusBadRequest, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		role := "broadcaster"
		for _, adminEmail := range app.Config.BootstrapAdminEmails {
			if strings.EqualFold(adminEmail, req.Email) {
				role = "admin"
				break
			}
		}

		user, err := service.Register(r.Context(), req.Email, req.Password, req.DisplayName, role)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, auth.ErrEmailExists) {
				status = http.StatusConflict
			}

			httpx.WriteJSON(w, status, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		httpx.WriteJSON(w, http.StatusCreated, user)
	})

	mux.HandleFunc("POST /login", func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := httpx.ReadJSON(r, &req); err != nil {
			httpx.WriteJSON(w, http.StatusBadRequest, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		user, token, err := service.Login(r.Context(), req.Email, req.Password)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, auth.ErrInvalidCredentials) {
				status = http.StatusUnauthorized
			}

			httpx.WriteJSON(w, status, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"user":  user,
			"token": token,
		})
	})

	mux.Handle("/me", auth.Middleware(app.Config.JWTSecret, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			httpx.WriteJSON(w, http.StatusUnauthorized, httpx.ErrorResponse{Error: auth.ErrUnauthorized.Error()})
			return
		}

		freshUser, err := service.GetUser(r.Context(), user.ID)
		if err != nil {
			httpx.WriteJSON(w, http.StatusNotFound, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		httpx.WriteJSON(w, http.StatusOK, freshUser)
	})))

	mux.Handle("/users", auth.RequireRoles(app.Config.JWTSecret, []string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.NotFound(w, r)
			return
		}

		users, err := service.ListUsers(r.Context())
		if err != nil {
			httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		httpx.WriteJSON(w, http.StatusOK, map[string]any{"users": users})
	})))

	mux.Handle("/users/", auth.RequireRoles(app.Config.JWTSecret, []string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/role") || r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}

		userID := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/users/"), "/role")
		if userID == "" {
			httpx.WriteJSON(w, http.StatusBadRequest, httpx.ErrorResponse{Error: "missing user id"})
			return
		}

		var req updateRoleRequest
		if err := httpx.ReadJSON(r, &req); err != nil {
			httpx.WriteJSON(w, http.StatusBadRequest, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		updated, err := service.UpdateUserRole(r.Context(), userID, strings.ToLower(strings.TrimSpace(req.Role)))
		if err != nil {
			httpx.WriteJSON(w, http.StatusInternalServerError, httpx.ErrorResponse{Error: err.Error()})
			return
		}

		httpx.WriteJSON(w, http.StatusOK, updated)
	})))

	if err := app.Run(ctx); err != nil {
		panic(err)
	}
}
