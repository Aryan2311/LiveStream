package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const userContextKey contextKey = "user"

var ErrUnauthorized = errors.New("unauthorized")

func Middleware(secret string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, err := UserFromRequest(r, secret)
		if err != nil {
			http.Error(w, ErrUnauthorized.Error(), http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func UserFromContext(ctx context.Context) (User, bool) {
	user, ok := ctx.Value(userContextKey).(User)
	return user, ok
}

func UserFromRequest(r *http.Request, secret string) (User, error) {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if authHeader == "" {
		return User{}, ErrUnauthorized
	}

	tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer"))
	if tokenString == "" || tokenString == authHeader {
		return User{}, ErrUnauthorized
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return User{}, ErrUnauthorized
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return User{}, ErrUnauthorized
	}

	user := User{
		ID:          toString(claims["sub"]),
		Email:       toString(claims["email"]),
		DisplayName: toString(claims["name"]),
		Role:        toString(claims["role"]),
	}
	if user.ID == "" {
		return User{}, ErrUnauthorized
	}

	return user, nil
}

func RequireRoles(secret string, roles []string, next http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		allowed[strings.ToLower(strings.TrimSpace(role))] = struct{}{}
	}

	return Middleware(secret, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := UserFromContext(r.Context())
		if !ok {
			http.Error(w, ErrUnauthorized.Error(), http.StatusUnauthorized)
			return
		}

		if _, exists := allowed[strings.ToLower(user.Role)]; !exists {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	}))
}

func toString(value any) string {
	str, _ := value.(string)
	return str
}
