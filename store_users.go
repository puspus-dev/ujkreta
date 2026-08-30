package main

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

// Role konstansok
const (
	RoleStudent = "Tanulo"
	RoleTeacher = "Tanar"
)

// GetUserByUsername – role oszloppal (a régi store.go változatot TÖRÖLD).
func (s *Store) GetUserByUsername(username string) (User, error) {
	ctx := context.Background()

	var user User
	var role *string

	err := s.db.QueryRow(
		ctx,
		`
		SELECT
			id::text,
			username,
			password_hash,
			student_uid,
			role,
			active,
			created_at
		FROM users
		WHERE username = $1
		LIMIT 1
		`,
		username,
	).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.StudentUID,
		&role,
		&user.Active,
		&user.CreatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return User{}, pgx.ErrNoRows
		}
		return User{}, err
	}

	if role != nil && *role != "" {
		user.Role = *role
	} else {
		user.Role = RoleStudent
	}

	return user, nil
}

// CreateUser – alapból Tanulo role (kompatibilis a régi hívásokkal).
func (s *Store) CreateUser(username, password, studentUID string) (User, error) {
	return s.CreateUserWithRole(username, password, studentUID, RoleStudent)
}

// CreateUserWithRole új user role-lal.
func (s *Store) CreateUserWithRole(
	username, password, linkedUID, role string,
) (User, error) {
	if username == "" {
		return User{}, fmt.Errorf("username nem lehet üres")
	}
	if password == "" {
		return User{}, fmt.Errorf("password nem lehet üres")
	}
	if role == "" {
		role = RoleStudent
	}
	if role != RoleStudent && role != RoleTeacher {
		return User{}, fmt.Errorf("role csak Tanulo vagy Tanar lehet")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, err
	}

	ctx := context.Background()

	var user User
	var roleOut string

	err = s.db.QueryRow(
		ctx,
		`
		INSERT INTO users (username, password_hash, student_uid, role, active)
		VALUES ($1, $2, $3, $4, TRUE)
		RETURNING id::text, username, password_hash, student_uid, role, active, created_at
		`,
		username,
		string(hash),
		linkedUID,
		role,
	).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.StudentUID,
		&roleOut,
		&user.Active,
		&user.CreatedAt,
	)
	if err != nil {
		return User{}, err
	}

	user.Role = roleOut
	return user, nil
}
