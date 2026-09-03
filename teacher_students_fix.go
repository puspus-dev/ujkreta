package main

import (
	"context"
	"fmt"
	"strings"
)

// ============================================================
// ÚJ metódusok – NEM ütközik a meglévő handlerekkel.
//
// PLUSZ kézi szerkesztés kötelező (lásd TEACHER_FIX_INSTALL.md):
// 1) teacher_store.go → GetTeacherStudents body cseréje
// 2) teacher.go → handleTeacherGrades / Omissions: DELETE ág
// ============================================================

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

func (s *Store) HardDeleteStudent(uid string) error {
	uid = strings.TrimSpace(uid)
	if uid == "" {
		return fmt.Errorf("uid_required")
	}
	ctx := context.Background()
	_, err := s.db.Exec(ctx, `DELETE FROM students WHERE uid = $1`, uid)
	if err != nil {
		return err
	}
	_, _ = s.db.Exec(ctx, `DELETE FROM users WHERE student_uid = $1`, uid)
	return nil
}

func (s *Store) HardDeleteUserByUsername(username string) error {
	username = strings.TrimSpace(username)
	if username == "" {
		return fmt.Errorf("username_required")
	}
	ctx := context.Background()
	_, err := s.db.Exec(ctx, `DELETE FROM users WHERE username = $1`, username)
	return err
}

func (s *Store) HardDeleteUserByLinkedUID(uid string) error {
	uid = strings.TrimSpace(uid)
	if uid == "" {
		return nil
	}
	ctx := context.Background()
	_, err := s.db.Exec(ctx, `DELETE FROM users WHERE student_uid = $1`, uid)
	return err
}
