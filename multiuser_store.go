package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

// ============================================================
// USER – role mezővel
// ============================================================

// UserRole: Tanulo | Tanar | Admin (admin HTTP Basic maradhat külön)
const (
	RoleStudent = "Tanulo"
	RoleTeacher = "Tanar"
)

// ============================================================
// STUDENTS
// ============================================================

func (s *Store) UpsertStudent(st Student, classGroupUID string) error {
	ctx := context.Background()

	raw, err := json.Marshal(st)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(
		ctx,
		`
		INSERT INTO students (uid, data, class_group_uid, active, created_at, updated_at)
		VALUES ($1, $2::jsonb, $3, TRUE, NOW(), NOW())
		ON CONFLICT (uid) DO UPDATE SET
			data = EXCLUDED.data,
			class_group_uid = EXCLUDED.class_group_uid,
			updated_at = NOW()
		`,
		st.Uid,
		string(raw),
		classGroupUID,
	)

	return err
}

func (s *Store) GetStudentByUID(uid string) (Student, error) {
	ctx := context.Background()

	var raw []byte

	err := s.db.QueryRow(
		ctx,
		`SELECT data FROM students WHERE uid = $1 AND active = TRUE LIMIT 1`,
		uid,
	).Scan(&raw)

	if err != nil {
		if err == pgx.ErrNoRows {
			// fallback: régi singleton
			st := s.GetStudent()
			if st.Uid == uid {
				return st, nil
			}
			return Student{}, fmt.Errorf("diák nem található: %s", uid)
		}
		return Student{}, err
	}

	var st Student
	if err := json.Unmarshal(raw, &st); err != nil {
		return Student{}, err
	}

	return st, nil
}

func (s *Store) GetStudentClassGroupUID(uid string) string {
	ctx := context.Background()

	var classUID *string

	err := s.db.QueryRow(
		ctx,
		`SELECT class_group_uid FROM students WHERE uid = $1 LIMIT 1`,
		uid,
	).Scan(&classUID)

	if err != nil || classUID == nil {
		groups := s.GetClassGroups()
		if len(groups) > 0 {
			return groups[0].Uid
		}
		return ""
	}

	return *classUID
}

func (s *Store) ListStudents() []Student {
	ctx := context.Background()

	rows, err := s.db.Query(
		ctx,
		`SELECT data FROM students WHERE active = TRUE ORDER BY uid`,
	)
	if err != nil {
		log.Printf("ListStudents: %v", err)
		return nil
	}
	defer rows.Close()

	out := make([]Student, 0)

	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			continue
		}
		var st Student
		if err := json.Unmarshal(raw, &st); err != nil {
			continue
		}
		out = append(out, st)
	}

	// Ha üres a students tábla, fallback a singletonra
	if len(out) == 0 {
		st := s.GetStudent()
		if st.Uid != "" {
			out = append(out, st)
		}
	}

	return out
}

// ============================================================
// GRADES – diák szerint szűrve
// ============================================================

// Grade-hez opcionális TanuloUid (JSON mező a Grade structban is legyen).
// Ha a structban még nincs, a filter a student_uid oszlopot + JSON path-et használ.

func (s *Store) GetGradesForStudent(studentUID string) []Grade {
	ctx := context.Background()

	// Először oszlop alapján
	rows, err := s.db.Query(
		ctx,
		`
		SELECT data FROM grades
		WHERE student_uid = $1
		   OR student_uid IS NULL
		   OR data->>'TanuloUid' = $1
		   OR data->>'TanuloUid' IS NULL
		   OR data->>'TanuloUid' = ''
		ORDER BY uid
		`,
		studentUID,
	)
	if err != nil {
		log.Printf("GetGradesForStudent: %v", err)
		return s.filterGradesFallback(studentUID)
	}
	defer rows.Close()

	out := make([]Grade, 0)

	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			continue
		}

		var g Grade
		if err := json.Unmarshal(raw, &g); err != nil {
			continue
		}

		// Ha van TanuloUid és nem egyezik, kihagyjuk
		if g.TanuloUid != "" && g.TanuloUid != studentUID {
			continue
		}

		out = append(out, g)
	}

	return out
}

func (s *Store) filterGradesFallback(studentUID string) []Grade {
	all := s.GetGrades()
	out := make([]Grade, 0, len(all))

	for _, g := range all {
		if g.TanuloUid == "" || g.TanuloUid == studentUID {
			out = append(out, g)
		}
	}

	return out
}

func (s *Store) AddGradeForStudent(g Grade) error {
	if g.Uid == "" {
		g.Uid = fmt.Sprintf("G%d", time.Now().UnixNano())
	}
	if g.TanuloUid == "" {
		return fmt.Errorf("TanuloUid kötelező")
	}

	raw, err := json.Marshal(g)
	if err != nil {
		return err
	}

	ctx := context.Background()

	_, err = s.db.Exec(
		ctx,
		`
		INSERT INTO grades (uid, data, student_uid, created_at, updated_at)
		VALUES ($1, $2::jsonb, $3, NOW(), NOW())
		ON CONFLICT (uid) DO UPDATE SET
			data = EXCLUDED.data,
			student_uid = EXCLUDED.student_uid,
			updated_at = NOW()
		`,
		g.Uid,
		string(raw),
		g.TanuloUid,
	)

	return err
}

// ============================================================
// OMISSIONS – diák szerint
// ============================================================

func (s *Store) GetOmissionsForStudent(studentUID string) []Omission {
	all := s.GetOmissions()
	out := make([]Omission, 0, len(all))

	for _, o := range all {
		if o.TanuloUid == "" || o.TanuloUid == studentUID {
			out = append(out, o)
		}
	}

	return out
}

func (s *Store) AddOmissionForStudent(o Omission) error {
	if o.Uid == "" {
		o.Uid = fmt.Sprintf("O%d", time.Now().UnixNano())
	}
	if o.TanuloUid == "" {
		return fmt.Errorf("TanuloUid kötelező")
	}

	raw, err := json.Marshal(o)
	if err != nil {
		return err
	}

	ctx := context.Background()

	_, err = s.db.Exec(
		ctx,
		`
		INSERT INTO omissions (uid, data, student_uid, created_at, updated_at)
		VALUES ($1, $2::jsonb, $3, NOW(), NOW())
		ON CONFLICT (uid) DO UPDATE SET
			data = EXCLUDED.data,
			student_uid = EXCLUDED.student_uid,
			updated_at = NOW()
		`,
		o.Uid,
		string(raw),
		o.TanuloUid,
	)

	return err
}

// ============================================================
// HOMEWORK / LESSONS / TESTS – osztály szerint
// ============================================================

func (s *Store) GetHomeworkForClass(classUID string) []Homework {
	all := s.GetHomework()
	if classUID == "" {
		return all
	}

	out := make([]Homework, 0, len(all))
	for _, h := range all {
		if h.OsztalyCsoport.Uid == "" || h.OsztalyCsoport.Uid == classUID {
			out = append(out, h)
		}
	}
	return out
}

func (s *Store) GetLessonsForClass(classUID string) []Lesson {
	all := s.GetLessons()
	if classUID == "" {
		return all
	}

	out := make([]Lesson, 0, len(all))
	for _, l := range all {
		if l.OsztalyCsoport.Uid == "" || l.OsztalyCsoport.Uid == classUID {
			out = append(out, l)
		}
	}
	return out
}

func (s *Store) GetTestsForClass(classUID string) []Test {
	all := s.GetTests()
	if classUID == "" {
		return all
	}

	out := make([]Test, 0, len(all))
	for _, t := range all {
		if t.OsztalyCsoport.Uid == "" || t.OsztalyCsoport.Uid == classUID {
			out = append(out, t)
		}
	}
	return out
}

// ============================================================
// USERS – role támogatással
// ============================================================

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
		return User{}, err
	}

	if role != nil && *role != "" {
		user.Role = *role
	} else {
		user.Role = RoleStudent
	}

	return user, nil
}

func (s *Store) CreateUserWithRole(
	username, password, linkedUID, role string,
) (User, error) {

	if username == "" || password == "" {
		return User{}, fmt.Errorf("username és password kötelező")
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

// EnsureDefaultUsers – seed diák + tanár user, ha még nincs.
func (s *Store) EnsureDefaultUsers() {
	if _, err := s.GetUserByUsername("student"); err != nil {
		st := s.GetStudent()
		uid := st.Uid
		if uid == "" {
			uid = "100"
		}
		_, _ = s.CreateUserWithRole("student", "student", uid, RoleStudent)
	}

	if _, err := s.GetUserByUsername("teacher"); err != nil {
		_, _ = s.CreateUserWithRole("teacher", "teacher", "300", RoleTeacher)
	}
}

// MigrateSingletonStudent – a régi kreta_store.student átvétele a students táblába.
func (s *Store) MigrateSingletonStudent() {
	st := s.GetStudent()
	if st.Uid == "" {
		return
	}

	classUID := ""
	groups := s.GetClassGroups()
	if len(groups) > 0 {
		classUID = groups[0].Uid
	}

	if err := s.UpsertStudent(st, classUID); err != nil {
		log.Printf("MigrateSingletonStudent: %v", err)
	}
}
