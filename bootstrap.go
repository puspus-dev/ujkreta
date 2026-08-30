package main

import (
	"log"
	"os"
)

// BootstrapMultiUser – hívd NewStore után a main()-ben.
func (s *Store) BootstrapMultiUser() {
	s.MigrateSingletonStudent()
	s.ensureEnvUsers()
	if t := s.GetTeacher(); t.Uid == "" {
		s.SetTeacher(seedTeacher())
	}
	log.Println("multi-user bootstrap kész")
}

func (s *Store) ensureEnvUsers() {
	// Diák: STUDENT_USERNAME / STUDENT_PASSWORD vagy alapértelmezett student/student
	sUser := envOr("STUDENT_USERNAME", "student")
	sPass := envOr("STUDENT_PASSWORD", "student")
	if _, err := s.GetUserByUsername(sUser); err != nil {
		uid := "100"
		if st := s.GetStudent(); st.Uid != "" {
			uid = st.Uid
		}
		if _, err := s.CreateUserWithRole(sUser, sPass, uid, RoleStudent); err != nil {
			log.Printf("student user create: %v", err)
		} else {
			log.Printf("diák user létrehozva: %s", sUser)
		}
	}

	// Tanár: TEACHER_USERNAME / TEACHER_PASSWORD (Render env)
	tUser := envOr("TEACHER_USERNAME", "teacher")
	tPass := envOr("TEACHER_PASSWORD", "teacher")
	if u, err := s.GetUserByUsername(tUser); err != nil {
		if _, err := s.CreateUserWithRole(tUser, tPass, "300", RoleTeacher); err != nil {
			log.Printf("teacher user create: %v", err)
		} else {
			log.Printf("tanár user létrehozva: %s", tUser)
		}
	} else if u.Role != RoleTeacher {
		// ha létezik, de nem tanár role – nem írjuk felül a jelszót automatikusan
		log.Printf("tanár user már létezik: %s (role=%s)", tUser, u.Role)
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
