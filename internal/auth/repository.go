package auth

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) CreateUser(ctx context.Context, user User) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO users (id, email, display_name, role, password_hash, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, user.ID, user.Email, user.DisplayName, user.Role, user.PasswordHash, user.CreatedAt)
	if err == nil {
		return nil
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrEmailExists
	}

	return err
}

func (r *PostgresRepository) GetUserByEmail(ctx context.Context, email string) (User, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, email, display_name, role, password_hash, created_at
		FROM users
		WHERE email = $1
	`, email)

	return scanUser(row)
}

func (r *PostgresRepository) GetUserByID(ctx context.Context, userID string) (User, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, email, display_name, role, password_hash, created_at
		FROM users
		WHERE id = $1
	`, userID)

	return scanUser(row)
}

func (r *PostgresRepository) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, email, display_name, role, password_hash, created_at
		FROM users
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		user, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	return users, rows.Err()
}

func (r *PostgresRepository) UpdateUserRole(ctx context.Context, userID, role string) (User, error) {
	row := r.db.QueryRowContext(ctx, `
		UPDATE users
		SET role = $2
		WHERE id = $1
		RETURNING id, email, display_name, role, password_hash, created_at
	`, userID, role)

	return scanUser(row)
}

type scanner interface {
	Scan(dest ...any) error
}

func scanUser(row scanner) (User, error) {
	var user User
	err := row.Scan(&user.ID, &user.Email, &user.DisplayName, &user.Role, &user.PasswordHash, &user.CreatedAt)
	return user, err
}
