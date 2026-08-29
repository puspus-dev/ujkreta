package main

import (
	"context"
	_ "embed"
	"fmt"
	"time"
     "context"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schemaSQL string

func NewDB(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL nincs beállítva")
	}

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("DATABASE_URL feldolgozása sikertelen: %w", err)
	}

	config.MaxConns = 10
	config.MinConns = 1
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute

	db, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("PostgreSQL pool létrehozása sikertelen: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := db.Ping(pingCtx); err != nil {
		db.Close()
		return nil, fmt.Errorf("PostgreSQL nem érhető el: %w", err)
	}

	if err := migrateDB(ctx, db); err != nil {
		db.Close()
		return nil, fmt.Errorf("adatbázis migráció sikertelen: %w", err)
	}

	return db, nil
}

func migrateDB(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, schemaSQL)
	return err
}