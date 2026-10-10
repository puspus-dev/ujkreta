package main

import (
	"context"
	"encoding/json"
	_ "fmt"
	"time"

	_ "golang.org/x/crypto/bcrypt"
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
	// Összes aktív diák a students táblából (nem csak a seed singleton)
	students := s.ListStudents()
	groups := s.GetClassGroups()
	groupByUID := map[string]string{}
	for _, g := range groups {
		groupByUID[g.Uid] = g.Nev
	}

	out := make([]TeacherStudent, 0, len(students))
	for _, st := range students {
		classUID := s.GetStudentClassGroupUID(st.Uid)
		className := groupByUID[classUID]
		if className == "" {
			className = classUID
		}
		if classUID == "" && len(groups) > 0 {
			classUID = groups[0].Uid
			className = groups[0].Nev
		}
		out = append(out, TeacherStudent{
			Uid:      st.Uid,
			Nev:      st.Nev,
			EmailCim: st.EmailCim,
			OsztalyCsoport: NameUid{
				Uid: classUID,
				Nev: className,
			},
		})
	}
	return out
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
		Megjegyzes:         req.Megjegyzes,
		Tipus:              tipus,
		ErtekFajta:         NameUidDesc{Uid: "1", Nev: "Osztályzat", Leiras: "Osztályzat"},
		ErtekeloTanarNeve:  teacher.Nev,
		Jelleg:             "Ertekeles",
		SzamErtek:          req.SzamErtek,
		SzovegesErtek:      req.SzovegesErtek,
		SulySzazalekErteke: req.SulySzazalekErteke,
		OsztalyCsoport:     UidRef{Uid: req.OsztalyCsoportUid},
		SortIndex:          len(grades) + 1,
		TanuloUid:          req.TanuloUid,
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
		TanuloUid:        req.TanuloUid,
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


// ============================================================
// TIMETABLE / LESSONS CRUD
// ============================================================

func (s *Store) AddLesson(req createLessonRequest) (Lesson, error) {
	teacher := s.GetTeacher()
	lessons := s.GetLessons()
	now := time.Now()
	uid := req.Uid
	if uid == "" {
		uid = nextUID("L", len(lessons))
	}
	subjName := req.TantargyNev
	if subjName == "" {
		subjName = req.TantargyUid
	}
	if subjName == "" {
		subjName = "Óra"
	}
	groupName := req.OsztalyCsoportNev
	if groupName == "" {
		groupName = req.OsztalyCsoportUid
	}
	datum := req.Datum
	if len(datum) >= 10 {
		datum = datum[:10]
	}
	if datum == "" {
		datum = now.Format("2006-01-02")
	}
	kezdet := req.KezdetIdopont
	veg := req.VegIdopont
	if kezdet == "" {
		kezdet = datum + "T08:00:00"
	}
	if veg == "" {
		veg = datum + "T08:45:00"
	}
	// normalize short times HH:MM
	if len(kezdet) == 5 {
		kezdet = datum + "T" + kezdet + ":00"
	}
	if len(veg) == 5 {
		veg = datum + "T" + veg + ":00"
	}
	lesson := Lesson{
		Uid:           uid,
		Datum:         datum,
		KezdetIdopont: kezdet,
		VegIdopont:    veg,
		Nev:           firstNonEmpty(req.Nev, subjName),
		Oraszam:       req.Oraszam,
		OsztalyCsoport: NameUid{Uid: req.OsztalyCsoportUid, Nev: groupName},
		TanarNeve:     teacher.Nev,
		Tantargy: Subject{
			Uid: firstNonEmpty(req.TantargyUid, "T-"+subjName),
			Nev: subjName,
		},
		Tema:      req.Tema,
		TeremNeve: req.TeremNeve,
		Tipus:     NameUidDesc{Uid: "1", Nev: "Óra", Leiras: "Tanóra"},
		Allapot:   NameUidDesc{Uid: "1", Nev: "Tervezett", Leiras: "Tervezett óra"},
		Letrehozas: iso(now),
		UtolsoModositas: iso(now),
	}
	if lesson.Oraszam == 0 {
		lesson.Oraszam = 1
	}
	lessons = append(lessons, lesson)
	s.SetLessons(lessons)
	return lesson, nil
}

func (s *Store) UpdateLesson(req createLessonRequest) (Lesson, error) {
	if req.Uid == "" {
		return Lesson{}, fmt.Errorf("uid_required")
	}
	lessons := s.GetLessons()
	for i, l := range lessons {
		if l.Uid != req.Uid {
			continue
		}
		if req.Datum != "" {
			d := req.Datum
			if len(d) >= 10 {
				d = d[:10]
			}
			l.Datum = d
		}
		if req.Oraszam != 0 {
			l.Oraszam = req.Oraszam
		}
		if req.KezdetIdopont != "" {
			k := req.KezdetIdopont
			if len(k) == 5 {
				k = l.Datum + "T" + k + ":00"
			}
			l.KezdetIdopont = k
		}
		if req.VegIdopont != "" {
			v := req.VegIdopont
			if len(v) == 5 {
				v = l.Datum + "T" + v + ":00"
			}
			l.VegIdopont = v
		}
		if req.TantargyNev != "" || req.TantargyUid != "" {
			name := firstNonEmpty(req.TantargyNev, req.TantargyUid)
			l.Tantargy = Subject{Uid: firstNonEmpty(req.TantargyUid, l.Tantargy.Uid), Nev: name}
			l.Nev = name
		}
		if req.OsztalyCsoportUid != "" || req.OsztalyCsoportNev != "" {
			l.OsztalyCsoport = NameUid{
				Uid: firstNonEmpty(req.OsztalyCsoportUid, l.OsztalyCsoport.Uid),
				Nev: firstNonEmpty(req.OsztalyCsoportNev, l.OsztalyCsoport.Nev),
			}
		}
		if req.TeremNeve != "" {
			l.TeremNeve = req.TeremNeve
		}
		if req.Tema != "" {
			l.Tema = req.Tema
		}
		l.UtolsoModositas = iso(time.Now())
		lessons[i] = l
		s.SetLessons(lessons)
		return l, nil
	}
	return Lesson{}, fmt.Errorf("not_found")
}

func (s *Store) DeleteLesson(uid string) error {
	if uid == "" {
		return fmt.Errorf("uid_required")
	}
	lessons := s.GetLessons()
	out := make([]Lesson, 0, len(lessons))
	found := false
	for _, l := range lessons {
		if l.Uid == uid {
			found = true
			continue
		}
		out = append(out, l)
	}
	if !found {
		return fmt.Errorf("not_found")
	}
	s.SetLessons(out)
	return nil
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
