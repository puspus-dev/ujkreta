package main

import "log"

// CallFromMain – hívd a main()-ben NewStore után:
//   server.store.BootstrapMultiUser()
func (s *Store) BootstrapMultiUser() {
	s.MigrateSingletonStudent()
	s.EnsureDefaultUsers()
	if t := s.GetTeacher(); t.Uid == "" {
		s.SetTeacher(seedTeacher())
	}
	log.Println("multi-user bootstrap: students + default users + teacher")
}
