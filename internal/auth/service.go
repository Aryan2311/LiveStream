package auth

import (
	"context"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrEmailExists        = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid credentials")
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	DisplayName  string    `json:"display_name"`
	Role         string    `json:"role"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type Service struct {
	repo   Repository
	secret []byte
}

type Repository interface {
	CreateUser(context.Context, User) error
	GetUserByEmail(context.Context, string) (User, error)
	GetUserByID(context.Context, string) (User, error)
	ListUsers(context.Context) ([]User, error)
	UpdateUserRole(context.Context, string, string) (User, error)
}

func NewService(secret string, repo Repository) *Service {
	return &Service{
		repo:   repo,
		secret: []byte(secret),
	}
}

func (s *Service) Register(ctx context.Context, email, password, displayName, role string) (User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, err
	}
	if role == "" {
		role = "broadcaster"
	}

	user := User{
		ID:           uuid.NewString(),
		Email:        email,
		DisplayName:  displayName,
		Role:         role,
		PasswordHash: string(hash),
		CreatedAt:    time.Now().UTC(),
	}

	if err := s.repo.CreateUser(ctx, user); err != nil {
		if errors.Is(err, ErrEmailExists) {
			return User{}, err
		}
		return User{}, err
	}

	return user, nil
}

func (s *Service) Login(ctx context.Context, email, password string) (User, string, error) {
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return User{}, "", ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return User{}, "", ErrInvalidCredentials
	}

	token, err := s.sign(user)
	if err != nil {
		return User{}, "", err
	}

	return user, token, nil
}

func (s *Service) GetUser(ctx context.Context, userID string) (User, error) {
	return s.repo.GetUserByID(ctx, userID)
}

func (s *Service) ListUsers(ctx context.Context) ([]User, error) {
	return s.repo.ListUsers(ctx)
}

func (s *Service) UpdateUserRole(ctx context.Context, userID, role string) (User, error) {
	return s.repo.UpdateUserRole(ctx, userID, role)
}

func (s *Service) sign(user User) (string, error) {
	claims := jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"name":  user.DisplayName,
		"role":  user.Role,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
		"iat":   time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}
