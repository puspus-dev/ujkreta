_elavult, hamarosan jön az új dokumentacio_
AlapadatokAzonosítás (Authentication): Bearer Token (az /oauth/token végpontról kapott token használatával)Tartalomtípus (Content-Type): application/json1. Hitelesítés (OAuth2)A rendszerbe történő bejelentkezéshez és a hívásokhoz szükséges Access Token megszerzéséhez.Token kérése / BejelentkezésVégpont: POST /oauth/tokenContent-Type: application/x-www-form-urlencodedKérés törzse (Form Data):ParaméterTípusLeírásuserNamestringA diák oktatási azonosítója / felhasználónevepasswordstringA felhasználó jelszavagrant_typestringÉrtéke: passwordclient_idstringA kliens azonosítója (pl. 9b023...)Sikeres válasz (200 OK):JSON{
  "access_token": "mock_access_token_12345",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "mock_refresh_token_67890"
}
2. Diák Profil & Osztályzatok (Student Data)Diák adatainak és jegyeinek lekéréseVégpont: GET /api/v3/studentFejléc: Authorization: Bearer <access_token>Sikeres válasz (200 OK):JSON{
  "InstituteCode": "mock_iskola",
  "InstituteName": "Mock Kréta Iskola",
  "Student": {
    "Uid": "123456",
    "Name": "Teszt Elek",
    "Mulasztasok": []
  },
  "Evaluations": [
    {
      "Uid": "eval_1",
      "Subject": { "Name": "Matematika" },
      "NumberValue": 5,
      "Value": "Jeles(5)",
      "Weight": 100,
      "Type": { "Name": "IrasbeliTémazaro" },
      "Date": "2026-02-15T10:00:00Z"
    },
    {
      "Uid": "eval_2",
      "Subject": { "Name": "Történelem" },
      "NumberValue": 4,
      "Value": "Jó(4)",
      "Weight": 100,
      "Type": { "Name": "Felelet" },
      "Date": "2026-02-20T11:30:00Z"
    }
  ]
}
3. Órarend (Timetable)Órák lekérése adott időszakraVégpont: GET /api/v3/timetableFejléc: Authorization: Bearer <access_token>Query paraméterek:fromDate (pl. 2026-09-01)toDate (pl. 2026-09-05)Sikeres válasz (200 OK):JSON[
  {
    "Uid": "lesson_101",
    "Subject": { "Name": "Informatika" },
    "Teacher": "Kovács István",
    "ClassRoom": "102-es terem",
    "StartTime": "2026-09-01T08:00:00Z",
    "EndTime": "2026-09-01T08:45:00Z",
    "Count": 1
  },
  {
    "Uid": "lesson_102",
    "Subject": { "Name": "Matematika" },
    "Teacher": "Nagy Anna",
    "ClassRoom": "204-es terem",
    "StartTime": "2026-09-01T08:55:00Z",
    "EndTime": "2026-09-01T09:40:00Z",
    "Count": 2
  }
]
4. Adminisztrációs & Teszt Végpontok (Admin / Mock Management)A szimulációs szerver egyedi funkciói az adatok módosítására és beállítására.Új kamu jegy beszúrása (Teszteléshez)Végpont: POST /admin/add-gradeContent-Type: application/jsonKérés törzse:JSON{
  "subject": "Fizika",
  "grade": 5,
  "weight": 100,
  "teacher": "Minta Péter"
}
Sikeres válasz (200 OK):JSON{
  "status": "success",
  "message": "Jegy sikeresen hozzáadva a mock adatbázishoz."
}
Mock Adatok Alaphelyzetbe ÁllításaVégpont: POST /admin/resetSikeres válasz (200 OK):JSON{
  "status": "reset_complete",
  "message": "Az adatok visszaálltak a data.json alapállapotára."
}
Hibakódok (Error Responses)401 Unauthorized: Érvénytelen vagy hiányzó Bearer token a kérés fejléces részében.400 Bad Request: Hibás paraméterek vagy hiányzó adatok a POST törzsben.500 Internal Server Error: Szerveroldali hiba (pl. nem sikerült beolvasni a data.json-t).