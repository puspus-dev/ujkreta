# ÚjKréta / KRÁTA API dokumentáció

**Base URL:** _keressetek ki ha annyira erdekel_ 
**Repo:** https://github.com/puspus-dev/ujkreta  
**Verzió:** sokadik

---

## Tartalom

1. [Áttekintés](#áttekintés)
2. [Autentikáció](#autentikáció)
3. [Diák API](#diák-api)
4. [Tanár (Napló) API](#tanár-napló-api)
5. [Admin API](#admin-api)
6. [Hibák](#hibák)
7. [CORS](#cors)

---

## Áttekintés

A szerver a hivatalos e-KRÉTA diák (`/ellenorzo/v3/sajat/*`) és egy mock tanári (`/naplo/v3/sajat/*`) API-t emulál.

| Réteg | Prefix | Role |
|-------|--------|------|
| Diák | `/ellenorzo/v3/sajat/*` | `Tanulo` |
| Tanár | `/naplo/v3/sajat/*` | `Tanar` |
| Admin | `/admin/*` | HTTP Basic |
| Health | `/health` | – |

Minden védett endpoint `Authorization: Bearer <access_token>` headert vár (kivéve admin: Basic Auth).

---

## Autentikáció

### `POST /connect/token`

OAuth2 token endpoint.

**Grant types:**

| grant_type | Paraméterek |
|------------|-------------|
| `password` | `username`, `password` |
| `refresh_token` | `refresh_token` |
| `authorization_code` | `code` |

**Példa (password):**

```http
POST /connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=password&username=teacher&password=teacher
```

**Sikeres válasz:**

```json
{
  "id_token": "<JWT, alg:none>",
  "access_token": "<opaque>",
  "expires_in": 43200,
  "token_type": "Bearer",
  "refresh_token": "<opaque>",
  "scope": "openid email offline_access kreta-ellenorzo-webapi.public"
}
```

Az `id_token` payload tartalmazza:

```json
{
  "kreta:institute_code": "mockschool",
  "kreta:institute_user_id": "300",
  "kreta:user_name": "teacher",
  "name": "Kovács Béla",
  "role": "Tanar",
  "iat": 1710000000
}
```

**Alapértelmezett seed userek:**

| Username | Password | Role | UID |
|----------|----------|------|-----|
| `student` | `student` | Tanulo | `100` |
| `teacher` | `teacher` | Tanar | `300` |

### Egyéb auth endpointok

| Endpoint | Metódus | Leírás |
|----------|---------|--------|
| `/Account/Login` | GET/POST | Login form / redirect flow |
| `/ellenorzo-student/prod/oauthredirect` | GET | OAuth redirect handler |

---

## Diák API

Minden endpoint: `GET`, `Authorization: Bearer …`, role: `Tanulo` (vagy bármely érvényes token a mockban).

| Endpoint | Leírás |
|----------|--------|
| `/ellenorzo/v3/sajat/TanuloAdatlap` | Diák profil |
| `/ellenorzo/v3/sajat/OsztalyCsoportok` | Osztálycsoportok |
| `/ellenorzo/v3/sajat/FaliujsagElemek` | Faliújság |
| `/ellenorzo/v3/sajat/Feljegyzesek` | Feljegyzések |
| `/ellenorzo/v3/sajat/Ertekelesek` | Értékelések |
| `/ellenorzo/v3/sajat/Ertekelesek/Atlagok/OsztalyAtlagok` | Osztályátlagok |
| `/ellenorzo/v3/sajat/OrarendElemek` | Órarend |
| `/ellenorzo/v3/sajat/Mulasztasok` | Mulasztások |
| `/ellenorzo/v3/sajat/HaziFeladatok` | Házi feladatok |
| `/ellenorzo/v3/sajat/BejelentettSzamonkeresek` | Bejelentett számonkérések |
| `/dktapi/intezmenyek/munkaterek/tanulok` | DKT tantárgyak |

### Diák válasz – `TanuloAdatlap` (részlet)

```json
{
  "Uid": "100",
  "Nev": "Teszt Elek",
  "Cimek": ["1234 Budapest, Példa utca 1."],
  "SzuletesiEv": 2008,
  "SzuletesiHonap": 9,
  "SzuletesiNap": 1,
  "EmailCim": "teszt.elek@example.com",
  "TanevUid": "2025/2026",
  "IntezmenyAzonosito": "mockschool",
  "IntezmenyNev": "Mock Gimnázium",
  "Gondviselok": [...],
  "Intezmeny": {...}
}
```

---

## Tanár (Napló) API

Prefix: `/naplo/v3/sajat/*`  
Auth: Bearer token, ajánlott role: `Tanar`.

### Profil és listák

| Endpoint | Metódus | Leírás |
|----------|---------|--------|
| `/naplo/v3/sajat/TanarAdatlap` | GET | Tanár profil |
| `/naplo/v3/sajat/OsztalyCsoportok` | GET | Tanár osztályai |
| `/naplo/v3/sajat/Tanulok` | GET | Diákok listája (osztályonként) |
| `/naplo/v3/sajat/OrarendElemek` | GET | Tanári órarend |
| `/naplo/v3/sajat/Ertekelesek` | GET | A tanár által rögzített értékelések |
| `/naplo/v3/sajat/HaziFeladatok` | GET | Házi feladatok |
| `/naplo/v3/sajat/Mulasztasok` | GET | Mulasztások |
| `/naplo/v3/sajat/BejelentettSzamonkeresek` | GET | Számonkérések |

### Írás (mock CRUD)

| Endpoint | Metódus | Leírás |
|----------|---------|--------|
| `/naplo/v3/sajat/Ertekelesek` | POST | Új értékelés |
| `/naplo/v3/sajat/HaziFeladatok` | POST | Új házi feladat |
| `/naplo/v3/sajat/Mulasztasok` | POST | Új mulasztás |
| `/naplo/v3/sajat/BejelentettSzamonkeresek` | POST | Új számonkérés |

### `GET /naplo/v3/sajat/TanarAdatlap`

```json
{
  "Uid": "300",
  "Nev": "Kovács Béla",
  "EmailCim": "kovacs.bela@mockschool.hu",
  "Telefonszam": "+36301112233",
  "IntezmenyAzonosito": "mockschool",
  "IntezmenyNev": "Mock Gimnázium",
  "OsztalyFonokOsztalyok": [
    { "Uid": "10,11.A", "Nev": "11.A" }
  ],
  "Tantargyak": [
    {
      "Uid": "1,MATEK",
      "Nev": "Matematika",
      "Kategoria": { "Uid": "1", "Nev": "Kötelező", "Leiras": "Kötelező tantárgy" },
      "SortIndex": 1
    }
  ]
}
```

### `GET /naplo/v3/sajat/Tanulok`

```json
[
  {
    "Uid": "100",
    "Nev": "Teszt Elek",
    "OsztalyCsoport": { "Uid": "10,11.A", "Nev": "11.A" },
    "EmailCim": "teszt.elek@example.com"
  }
]
```

### `POST /naplo/v3/sajat/Ertekelesek`

**Body:**

```json
{
  "TantargyUid": "1,MATEK",
  "Tema": "Lineáris egyenletek",
  "SzamErtek": 4,
  "SzovegesErtek": "Jó",
  "SulySzazalekErteke": 100,
  "Tipus": { "Uid": "1", "Nev": "Írásbeli", "Leiras": "Írásbeli felelet" },
  "OsztalyCsoportUid": "10,11.A",
  "TanuloUid": "100"
}
```

**Válasz:** a létrehozott `Grade` objektum (`201 Created`).

### `POST /naplo/v3/sajat/HaziFeladatok`

```json
{
  "TantargyUid": "1,MATEK",
  "Szoveg": "30. oldal 1–5. feladat",
  "Hatarido": "2026-09-05T23:59:59",
  "OsztalyCsoportUid": "10,11.A"
}
```

### `POST /naplo/v3/sajat/Mulasztasok`

```json
{
  "TanuloUid": "100",
  "Datum": "2026-08-29T00:00:00",
  "Tipus": { "Uid": "1", "Nev": "Hiányzás", "Leiras": "Hiányzás" },
  "KesesPercben": 0,
  "OsztalyCsoportUid": "10,11.A"
}
```

### `POST /naplo/v3/sajat/BejelentettSzamonkeresek`

```json
{
  "TantargyUid": "1,MATEK",
  "Datum": "2026-09-10T08:00:00",
  "Modja": { "Uid": "1", "Nev": "Dolgozat", "Leiras": "Írásbeli dolgozat" },
  "OsztalyCsoportUid": "10,11.A"
}
```

---

## Admin API

Auth: **HTTP Basic** (`ADMIN_USERNAME` / `ADMIN_PASSWORD` env).

| Endpoint | Metódus | Leírás |
|----------|---------|--------|
| `/admin` | GET | Endpoint lista |
| `/admin/health` | GET | Health |
| `/admin/config` | GET, PUT, POST | Szerver konfig |
| `/admin/student` | GET, PUT, POST | Diák profil szerkesztés |
| `/admin/teacher` | GET, PUT, POST | Tanár profil szerkesztés |
| `/admin/reset` | POST | Mock adatok visszaállítása |
| `/admin/users` | POST | Új user (role támogatással) |

### `POST /admin/users`

```json
{
  "username": "tanar2",
  "password": "titok",
  "studentUid": "300",
  "role": "Tanar"
}
```

`role` opcionális, alapértelmezés: `Tanulo`.  
`studentUid` tanár esetén a tanár UID-ját jelenti (`teacher_uid` alias is elfogadott).

---

## Hibák

OAuth / token hibák:

```json
{
  "error": "invalid_grant",
  "error_description": "Hibás felhasználónév vagy jelszó."
}
```

Általános:

```json
{
  "error": "method_not_allowed"
}
```

| HTTP | Jelentés |
|------|----------|
| 400 | Hibás kérés / JSON |
| 401 | Hiányzó / érvénytelen token vagy Basic Auth |
| 405 | Nem engedélyezett metódus |
| 500 | Szerverhiba |

---

## CORS

Jelenleg engedélyezett origin: `https://puspus-dev.github.io`  
(Credentials, Authorization, Content-Type, Accept header-ekkel.)

A tanár frontend fejlesztéshez javasolt bővíteni pl. `http://localhost:*` originökkel.

---

## Health

```http
GET /health
→ { "status": "ok" }
```

---

## Gyors teszt (curl)

```bash
# Token tanárként
TOKEN=$(curl -s -X POST https://nemkapodmeg.onrender.com/connect/token \
  -d "grant_type=password&username=teacher&password=teacher" \
  | jq -r .access_token)

# Tanár profil
curl -s -H "Authorization: Bearer $TOKEN" \
  https://keresdki.onrender.com/naplo/v3/sajat/TanarAdatlap | jq

# Új jegy
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"TantargyUid":"1,MATEK","Tema":"Teszt","SzamErtek":5,"SzovegesErtek":"Jeles","SulySzazalekErteke":100,"OsztalyCsoportUid":"10,11.A","TanuloUid":"100"}' \
  https://megmindignem.onrender.com/naplo/v3/sajat/Ertekelesek | jq
```
