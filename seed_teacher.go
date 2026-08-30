package main

// seedTeacherData – tanár seed, a meglévő seedData() mellé / után hívható.
// A teacher mezőt a kreta_store.teacher JSONB oszlopba kell menteni.

func seedTeacher() Teacher {
	mathSubject := Subject{
		Uid:       "1,MATEK",
		Nev:       "Matematika",
		Kategoria: NameUidDesc{Uid: "1", Nev: "Kötelező", Leiras: "Kötelező tantárgy"},
		SortIndex: 1,
	}
	litSubject := Subject{
		Uid:       "2,MAGYAR",
		Nev:       "Magyar nyelv és irodalom",
		Kategoria: NameUidDesc{Uid: "1", Nev: "Kötelező", Leiras: "Kötelező tantárgy"},
		SortIndex: 2,
	}

	return Teacher{
		Uid:                "300",
		Nev:                "Kovács Béla",
		EmailCim:           "kovacs.bela@mockschool.hu",
		Telefonszam:        "+36301112233",
		IntezmenyAzonosito: "mockschool",
		IntezmenyNev:       "Mock Gimnázium",
		OsztalyFonokOsztalyok: []NameUid{
			{Uid: "10,11.A", Nev: "11.A"},
		},
		Tantargyak: []Subject{mathSubject, litSubject},
	}
}

// ensureTeacherUser létrehozza a teacher / teacher usert, ha még nincs.
func (s *Store) ensureTeacherUser() {
	_, err := s.GetUserByUsername("teacher")
	if err == nil {
		return
	}

	_, _ = s.CreateUserWithRole(
		"teacher",
		"teacher",
		"300",
		"Tanar",
	)
}
