package main

import (
	"context"
	"fmt"
	"strings"
)

// Csak jegy / mulasztás törlés.
// NINCS itt HardDelete* (az a server.go-ban van).
// NINCS itt GetTeacherStudents (az a teacher_store.go-ban van).

func (s *Store) DeleteGrade(uid string) error {
	uid = strings.TrimSpace(uid)
	if uid == "" {
		return fmt.Errorf("uid_required")
	}
	grades := s.GetGrades()
	filtered := make([]Grade, 0, len(grades))
	for _, g := range grades {
		if g.Uid == uid {
			continue
		}
		filtered = append(filtered, g)
	}
	s.SetGrades(filtered)
	ctx := context.Background()
	_, _ = s.db.Exec(ctx, `DELETE FROM grades WHERE uid = $1 OR data->>'Uid' = $1`, uid)
	return nil
}

func (s *Store) DeleteOmission(uid string) error {
	uid = strings.TrimSpace(uid)
	if uid == "" {
		return fmt.Errorf("uid_required")
	}
	list := s.GetOmissions()
	filtered := make([]Omission, 0, len(list))
	for _, o := range list {
		if o.Uid == uid {
			continue
		}
		filtered = append(filtered, o)
	}
	s.SetOmissions(filtered)
	ctx := context.Background()
	_, _ = s.db.Exec(ctx, `DELETE FROM omissions WHERE uid = $1 OR data->>'Uid' = $1`, uid)
	return nil
}
