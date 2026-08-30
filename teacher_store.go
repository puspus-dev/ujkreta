package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// ============================================================
// TEACHER STORE METHODS
// ============================================================

func (s *Store) GetTeacher() Teacher {
	_ = s.ensureSeeded()

	ctx := context.Background()

	var raw []byte

	err := s.db.QueryRow(
		ctx,
		`
		SELECT COALESCE(teacher, '{}'::jsonb)
		FROM kreta_store
		WHERE id = 1
		`,
	).Scan(&raw)

	if err != nil {
		return Teacher{}
	}

	var t Teacher

	if err := json.Unmarshal(raw, &t); err != nil {
		return Teacher{}
	}

	return t
}

func (s *Store) SetTeacher(v Teacher) {
	_ = s.ensureSeeded()

	raw, err := json.Marshal(v)
	if err != nil {
		return
	}

	ctx := context.Background()

	_, _ = s.db.Exec(
		ctx,
		`
		UPDATE kreta_store
		SET teacher = $1::jsonb,
		    updated_at = NOW()
		WHERE id = 1
		`,
		string(raw),
	)
}

func (s *Store) GetTeacherStudents() []TeacherStudent {
	student := s.GetStudent()
	groups := s.GetClassGroups()

	groupName := "11.A"
	groupUID := "10,11.A"

	if len(groups) > 0 {
		groupName = groups[0].Nev
		groupUID = groups[0].Uid
	}

	return []TeacherStudent{
		{
			Uid:      student.Uid,
			Nev:      student.Nev,
			EmailCim: student.EmailCim,
			OsztalyCsoport: NameUid{
				Uid: groupUID,
				Nev: groupName,
			},
		},
	}
}

// ============================================================
// ADD GRADE
// ============================================================

func (s *Store) AddGrade(req createGradeRequest) (Grade, error) {
	teacher := s.GetTeacher()
	grades := s.GetGrades()

	subject := findSubjectByUID(req.TantargyUid, teacher.Tantargyak)
	if subject.Uid == "" {
		// fallback known subjects from seed
		subject = Subject{
			Uid:       req.TantargyUid,
			Nev:       req.TantargyUid,
			Kategoria: NameUidDesc{Uid: "1", Nev: "Kötelező", Leiras: "Kötelező tantárgy"},
			SortIndex: 1,
		}
	}

	tipus := NameUidDesc{Uid: "1", Nev: "Írásbeli", Leiras: "Írásbeli felelet"}
	if req.Tipus != nil {
		tipus = *req.Tipus
	}

	now := time.Now()
	uid := nextUID("G", len(grades))

	grade := Grade{
		Uid:                uid,
		RogzitesDatuma:     iso(now),
		KeszitesDatuma:     iso(now),
		Tantargy:           subject,
		Tema:               req.Tema,
		Tipus:              tipus,
		ErtekFajta:         NameUidDesc{Uid: "1", Nev: "Osztályzat", Leiras: "Osztályzat"},
		ErtekeloTanarNeve:  teacher.Nev,
		Jelleg:             "Ertekeles",
		SzamErtek:          req.SzamErtek,
		SzovegesErtek:      req.SzovegesErtek,
		SulySzazalekErteke: req.SulySzazalekErteke,
		OsztalyCsoport:     UidRef{Uid: req.OsztalyCsoportUid},
		SortIndex:          len(grades) + 1,
	}

	if grade.SulySzazalekErteke == 0 {
		grade.SulySzazalekErteke = 100
	}

	grades = append(grades, grade)
	s.SetGrades(grades)

	return grade, nil
}

// ============================================================
// ADD HOMEWORK
// ============================================================

func (s *Store) AddHomework(req createHomeworkRequest) (Homework, error) {
	teacher := s.GetTeacher()
	list := s.GetHomework()

	subject := findSubjectByUID(req.TantargyUid, teacher.Tantargyak)
	if subject.Uid == "" {
		subject = Subject{
			Uid:       req.TantargyUid,
			Nev:       req.TantargyUid,
			Kategoria: NameUidDesc{Uid: "1", Nev: "Kötelező", Leiras: "Kötelező tantárgy"},
		}
	}

	now := time.Now()
	uid := nextUID("H", len(list))

	hatarido := req.Hatarido
	if hatarido == "" {
		hatarido = iso(now.Add(7 * 24 * time.Hour))
	}

	hw := Homework{
		Uid:               uid,
		Tantargy:          subject,
		TantargyNeve:      subject.Nev,
		RogzitoTanarNeve:  teacher.Nev,
		Szoveg:            req.Szoveg,
		FeladasDatuma:     iso(now),
		HataridoDatuma:    hatarido,
		RogzitesIdopontja: iso(now),
		IsTanarRogzitette: true,
		IsMegoldva:        false,
		IsBeadhato:        true,
		OsztalyCsoport:    UidRef{Uid: req.OsztalyCsoportUid},
	}

	list = append(list, hw)
	s.SetHomework(list)

	return hw, nil
}

// ============================================================
// ADD OMISSION
// ============================================================

func (s *Store) AddOmission(req createOmissionRequest) (Omission, error) {
	teacher := s.GetTeacher()
	list := s.GetOmissions()

	tipus := NameUidDesc{Uid: "1", Nev: "Hiányzás", Leiras: "Hiányzás"}
	if req.Tipus != nil {
		tipus = *req.Tipus
	}

	now := time.Now()
	uid := nextUID("O", len(list))

	datum := req.Datum
	if datum == "" {
		datum = iso(now)
	}

	om := Omission{
		Uid:              uid,
		Datum:            datum,
		RogzitoTanarNeve: teacher.Nev,
		Tipus:            tipus,
		KesesPercben:     req.KesesPercben,
		KeszitesDatuma:   iso(now),
		IgazolasAllapota: "Igazolatlan",
		OsztalyCsoport:   UidRef{Uid: req.OsztalyCsoportUid},
	}

	list = append(list, om)
	s.SetOmissions(list)

	return om, nil
}

// ============================================================
// ADD TEST
// ============================================================

func (s *Store) AddTest(req createTestRequest) (Test, error) {
	teacher := s.GetTeacher()
	list := s.GetTests()

	subject := findSubjectByUID(req.TantargyUid, teacher.Tantargyak)
	if subject.Uid == "" {
		subject = Subject{
			Uid: req.TantargyUid,
			Nev: req.TantargyUid,
		}
	}

	modja := NameUidDesc{Uid: "1", Nev: "Dolgozat", Leiras: "Írásbeli dolgozat"}
	if req.Modja != nil {
		modja = *req.Modja
	}

	now := time.Now()
	uid := nextUID("T", len(list))

	datum := req.Datum
	if datum == "" {
		datum = iso(now.Add(7 * 24 * time.Hour))
	}

	test := Test{
		Uid:                 uid,
		Datum:               datum,
		BejelentesDatuma:    iso(now),
		RogzitoTanarNeve:    teacher.Nev,
		Tantargy:            subject,
		Modja:               modja,
		OsztalyCsoport:      UidRef{Uid: req.OsztalyCsoportUid},
	}

	list = append(list, test)
	s.SetTests(list)

	return test, nil
}

// ============================================================
// USER ROLE SUPPORT
// ============================================================

// CreateUserWithRole új felhasználót hoz létre role mezővel.
func (s *Store) CreateUserWithRole(
	username string,
	password string,
	linkedUID string,
	role string,
) (User, error) {

	if username == "" {
		return User{}, fmt.Errorf("username nem lehet üres")
	}

	if password == "" {
		return User{}, fmt.Errorf("password nem lehet üres")
	}

	if role == "" {
		role = "Tanulo"
	}

	if role != "Tanulo" && role != "Tanar" {
		return User{}, fmt.Errorf("role csak Tanulo vagy Tanar lehet")
	}

	hash, err := bcrypt.GenerateFromPassword(
		[]byte(password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return User{}, err
	}

	ctx := context.Background()

	var user User

	err = s.db.QueryRow(
		ctx,
		`
		INSERT INTO users (
			username,
			password_hash,
			student_uid,
			role,
			active
		)
		VALUES ($1, $2, $3, $4, TRUE)
		RETURNING
			id::text,
			username,
			password_hash,
			student_uid,
			COALESCE(role, 'Tanulo'),
			active,
			created_at
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
		&user.Role,
		&user.Active,
		&user.CreatedAt,
	)

	if err != nil {
		return User{}, err
	}

	return user, nil
}

func (s *Store) GetUserByUsernameWithRole(username string) (User, error) {
	ctx := context.Background()

	var user User

	err := s.db.QueryRow(
		ctx,
		`
		SELECT
			id::text,
			username,
			password_hash,
			student_uid,
			COALESCE(role, 'Tanulo'),
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
		&user.Role,
		&user.Active,
		&user.CreatedAt,
	)

	if err != nil {
		return User{}, err
	}

	return user, nil
}

// ============================================================
// HELPERS
// ============================================================

func findSubjectByUID(uid string, subjects []Subject) Subject {
	for _, s := range subjects {
		if s.Uid == uid {
			return s
		}
	}
	return Subject{}
}
