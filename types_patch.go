package main

// ============================================================
// TÍPUS BŐVÍTÉSEK – illeszd a store.go structokhoz
// ============================================================

// Grade structba add hozzá:
//
//	TanuloUid string `json:"TanuloUid,omitempty"`
//
// Omission structba:
//
//	TanuloUid string `json:"TanuloUid,omitempty"`
//
// User structba:
//
//	Role string `json:"role"`
//
// sessionInfo (auth.go):
//
//	Role string `json:"role"`

// Ez a fájl dokumentációs / emlékeztető.
// A tényleges mezőket a store.go / auth.go structjaiban kell felvenni,
// különben a JSON marshal/unmarshal nem tölti ki őket.

// Példa a módosított Grade-re (részlet):
/*
type Grade struct {
	Uid                       string       `json:"Uid"`
	RogzitesDatuma            string       `json:"RogzitesDatuma"`
	KeszitesDatuma            string       `json:"KeszitesDatuma"`
	LattamozasDatuma          string       `json:"LattamozasDatuma,omitempty"`
	Tantargy                  Subject      `json:"Tantargy"`
	Tema                      string       `json:"Tema,omitempty"`
	Tipus                     NameUidDesc  `json:"Tipus"`
	Mod                       *NameUidDesc `json:"Mod,omitempty"`
	ErtekFajta                NameUidDesc  `json:"ErtekFajta"`
	ErtekeloTanarNeve         string       `json:"ErtekeloTanarNeve"`
	Jelleg                    string       `json:"Jelleg,omitempty"`
	SzamErtek                 int          `json:"SzamErtek,omitempty"`
	SzovegesErtek             string       `json:"SzovegesErtek"`
	SulySzazalekErteke        int          `json:"SulySzazalekErteke,omitempty"`
	SzovegesErtekelesRovidNev string       `json:"SzovegesErtekelesRovidNev,omitempty"`
	OsztalyCsoport            UidRef       `json:"OsztalyCsoport"`
	SortIndex                 int          `json:"SortIndex"`
	TanuloUid                 string       `json:"TanuloUid,omitempty"` // ÚJ
}
*/
