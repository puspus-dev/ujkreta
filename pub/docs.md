# ÚjKréta / KRÁTA API dokumentáció

**Base URL:** `https://ujkreta.onrender.com`  
**Repo:** https://github.com/puspus-dev/ujkreta  

---

## Tartalom

1. [Áttekintés](#áttekintés)
2. [Autentikáció](#autentikáció)
3. [Intézmények](#intézmények)
4. [Diák API](#diák-api)
5. [Tanár (Napló) API](#tanár-napló-api)
6. [E-ügyintézés – üzenetek](#e-ügyintézés--üzenetek)
7. [Osztályfőnök](#osztályfőnök)
8. [Admin API](#admin-api)
9. [Hibák](#hibák)
10. [CORS](#cors)
11. [Health](#health)

---

## Áttekintés

| Réteg | Prefix | Auth |
|-------|--------|------|
| Diák | `/ellenorzo/v3/sajat/*` | Bearer |
| Tanár | `/naplo/v3/sajat/*` | Bearer, role `Tanar` / `Osztalyfonok` |
| E-ügyintézés | `/integration-kretamobile-api/v1/kommunikacio/*` | Bearer |
| Intézmények | `/intezmenyek` | publikus GET |
| Admin | `/admin/*` | HTTP Basic |
| Health | `/health` | – |

---

## Autentikáció

### `POST /connect/token`

| grant_type | Paraméterek |
|------------|-------------|
| `password` | `username`, `password`, opcionálisan `institute_code` |
| `refresh_token` | `refresh_token` |
| `authorization_code` | `code` |

```http
POST /connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=password&username=student&password=student&institute_code=dae0004
```

**Válasz:**

```json
{
  "id_token": "<JWT alg:none>",
  "access_token": "<opaque>",
  "expires_in": 43200,
  "token_type": "Bearer",
  "refresh_token": "<opaque>",
  "scope": "openid email offline_access kreta-ellenorzo-webapi.public"
}
```

**`id_token` claims (példa):**

```json
{
  "kreta:institute_code": "dae0004",
  "kreta:institute_user_id": "100",
  "kreta:user_name": "student",
  "name": "Teszt Elek",
  "role": "Tanulo",
  "iat": 1710000000
}
```

**Role értékek:** `Tanulo` | `Tanar` | `Osztalyfonok`

Védett hívások:

```http
Authorization: Bearer <access_token>
```

---

## Intézmények

### `GET /intezmenyek`  
Alias: `GET /api/public/institutions`  

**Auth:** nincs (főoldali intézményválasztó).

```json
[
  {
    "Uid": "dae0004",
    "Kod": "dae0004",
    "Nev": "SuliKód Gimnázium",
    "RovidNev": "SuliKód",
    "Varos": "Kisvárda"
  }
]
```

### Admin: `GET|POST|DELETE /admin/institutions`

Basic Auth.  
POST body: `{ "Uid", "Kod", "Nev", "RovidNev", "Varos", "Active" }`  
DELETE: `?uid=` vagy `?kod=`

---

## Diák API

Prefix: `/ellenorzo/v3/sajat/*` — mind `GET`, Bearer.

| Endpoint | Leírás |
|----------|--------|
| `/TanuloAdatlap` | Profil |
| `/OsztalyCsoportok` | Osztályok |
| `/FaliujsagElemek` | Faliújság |
| `/Feljegyzesek` | Feljegyzések |
| `/Ertekelesek` | Értékelések |
| `/Ertekelesek/Atlagok/OsztalyAtlagok` | Osztályátlagok |
| `/OrarendElemek` | Órarend |
| `/Mulasztasok` | Mulasztások |
| `/HaziFeladatok` | Házi |
| `/BejelentettSzamonkeresek` | Számonkérések |
| `/dktapi/intezmenyek/munkaterek/tanulok` | DKT |

---

## Tanár (Napló) API

Prefix: `/naplo/v3/sajat/*`  
Auth: Bearer, role `Tanar` vagy `Osztalyfonok`.

### Olvasás

| Endpoint | Metódus |
|----------|---------|
| `/TanarAdatlap` | GET |
| `/OsztalyCsoportok` | GET |
| `/Tanulok` | GET |
| `/OrarendElemek` | GET |
| `/Ertekelesek` | GET |
| `/HaziFeladatok` | GET |
| `/Mulasztasok` | GET |
| `/BejelentettSzamonkeresek` | GET |

### Írás / törlés (mock)

| Endpoint | Metódus |
|----------|---------|
| `/Ertekelesek` | POST, DELETE |
| `/HaziFeladatok` | POST (, DELETE ha telepítve) |
| `/Mulasztasok` | POST, DELETE |
| `/BejelentettSzamonkeresek` | POST |

### OF extra

| Endpoint | Metódus | Leírás |
|----------|---------|--------|
| `/Of/Diakok` | GET, POST, DELETE | Diák lista / felvétel |
| `/Of/Users` | POST | Csak `Tanulo` user |

---

## E-ügyintézés – üzenetek

Hivatalos mobil path a mock szerveren (ugyanaz a host).

**Prefix:** `/integration-kretamobile-api/v1/kommunikacio`  
**Auth:** `Authorization: Bearer <access_token>`

### 1. Postafiók lista

```http
GET /integration-kretamobile-api/v1/kommunikacio/postaladaelemek/sajat
```

- A `uzenet.szoveg` mező **legfeljebb ~100 karakter** (lista nézet).
- Üres postafiók: `[]` (a valós szerver néha 500-at ad).

**Válasz (tömb):**

```json
[
  {
    "azonosito": 1001,
    "isElolvasva": false,
    "isToroltElem": false,
    "tipus": {
      "azonosito": 1,
      "kod": "BEERKEZETT",
      "rovidNev": "Beérkezett üzenet",
      "nev": "Beérkezett üzenet",
      "leiras": "Beérkezett üzenet"
    },
    "uzenet": {
      "azonosito": 50001,
      "kuldesDatum": "2026-09-25T10:00:00",
      "feladoNev": "Kovács Béla",
      "feladoTitulus": "tanár",
      "szoveg": "Kedves Szülő / Gondviselő! …",
      "targy": "Szülői értekezlet",
      "cimzettLista": [
        {
          "azonosito": 70001,
          "kretaAzonosito": 100,
          "nev": "Teszt Elek",
          "tipus": {
            "azonosito": 4,
            "kod": "OSZTALY_TANULO",
            "rovidNev": "Osztály - Tanuló",
            "nev": "Osztály - Tanuló",
            "leiras": "Osztály - Tanuló"
          }
        }
      ],
      "csatolmanyok": [
        { "azonosito": 90001, "fajlNev": "tematika.pdf" }
      ]
    }
  }
]
```

### 2. Üzenet részlete (teljes szöveg)

```http
GET /integration-kretamobile-api/v1/kommunikacio/postaladaelemek/{azonosito}
```

`{azonosito}` = a lista **legkülső** `azonosito` mezője (pl. `1001`).

- Találat: egy objektum (nem tömb), **teljes** `uzenet.szoveg`.
- Nincs ilyen id: **HTTP 500**, body: `An error has occured!`

### 3. Olvasottnak jelölés

```http
POST /integration-kretamobile-api/v1/kommunikacio/uzenetek/olvasott
Content-Type: application/json
```

```json
{
  "isOlvasott": true,
  "uzenetAzonositoLista": [1001, 1002]
}
```

Siker: `{ "success": true }` — az elemek `isElolvasva` mezője `true` lesz.

### 4. Üzenet küldése (mock extra)

```http
POST /integration-kretamobile-api/v1/kommunikacio/uzenetek
Content-Type: application/json
```

```json
{
  "targy": "Tárgy",
  "szoveg": "Teljes üzenet szövege…",
  "cimzettUid": "100",
  "cimzettNev": "Teszt Elek",
  "feladoNev": "Kovács Béla",
  "feladoTitulus": "tanár"
}
```

**201** + a létrehozott postafiók-elem.

### curl példák

```bash
BASE=https://ujkreta.onrender.com

TOKEN=$(curl -s -X POST "$BASE/connect/token" \
  -d "grant_type=password&username=student&password=student" \
  | jq -r .access_token)

# Lista
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/integration-kretamobile-api/v1/kommunikacio/postaladaelemek/sajat" | jq

# Részlet
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/integration-kretamobile-api/v1/kommunikacio/postaladaelemek/1001" | jq

# Olvasott
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isOlvasott":true,"uzenetAzonositoLista":[1001]}' \
  "$BASE/integration-kretamobile-api/v1/kommunikacio/uzenetek/olvasott" | jq
```

---

## Osztályfőnök

- User role: **`Osztalyfonok`** (Admin → felhasználók).
- Belépés: fő login → `/osztalyfonok/` felület.
- Napló API: ugyanaz, mint tanár (`requireTeacher` engedi).
- Diák + diák-user felvétel: `/naplo/v3/sajat/Of/*` (ha telepítve).

---

## Admin API

**Auth:** HTTP Basic (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).

| Endpoint | Metódus | Leírás |
|----------|---------|--------|
| `/admin/health` | GET | Admin él |
| `/admin/config` | GET, PUT | Konfig |
| `/admin/student` | GET, PUT | Singleton diák |
| `/admin/students` | GET, POST, DELETE | Több diák |
| `/admin/teacher` | GET, PUT, POST, DELETE | Tanár |
| `/admin/users` | GET, POST, DELETE | Userek |
| `/admin/institutions` | GET, POST, DELETE | Intézmények |
| `/admin/reset` | POST | Mock reset |

### `POST /admin/users`

```json
{
  "username": "of1",
  "password": "titok",
  "studentUid": "",
  "role": "Osztalyfonok"
}
```

`role`: `Tanulo` | `Tanar` | `Osztalyfonok`

### `POST /admin/students`

```json
{
  "student": {
    "Uid": "OA200001",
    "Nev": "Kovács Anna",
    "IntezmenyAzonosito": "dae0004",
    "IntezmenyNev": "SuliKód",
    "TanevUid": "2025/2026"
  },
  "classGroupUid": "",
  "username": "anna",
  "password": "anna123"
}
```

---

## Hibák

```json
{
  "error": "invalid_grant",
  "error_description": "Hibás felhasználónév vagy jelszó."
}
```

| HTTP | Jelentés |
|------|----------|
| 400 | Hibás kérés / JSON |
| 401 | Token / Basic Auth |
| 403 | Role nem elég (pl. nem tanár) |
| 405 | Method not allowed |
| 500 | Szerverhiba / hiányzó üzenet id (e-ügyintézés) |

---

## CORS

Engedélyezett origin tipikusan: `https://puspus-dev.github.io`  
(+ fejlesztéshez localhost, iktató domain, ha be van állítva).

---

## Health

```http
GET /health
→ { "status": "ok" }
```
