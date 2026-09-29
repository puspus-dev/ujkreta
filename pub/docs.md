# ÚjKréta / KRÁTA API dokumentáció

**Base URL:** `https://ujkreta.onrender.com`  
**Repo:** https://github.com/puspus-dev/ujkreta  

---

## Tartalom

1. [Áttekintés](#áttekintés)
2. [Autentikáció](#autentikáció)
3. [Kétfaktoros azonosítás (2FA)](#kétfaktoros-azonosítás-2fa)
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
| 2FA | `/ellenorzo/v3/sajat/Mfa/*`, `/connect/mfa/verify` | Bearer / mfa_token |
| E-ügyintézés | `/integration-kretamobile-api/v1/kommunikacio/*` | Bearer |
| Admin | `/admin/*` | HTTP Basic |
| Health | `/health` | – |

---

## Autentikáció

### `POST /connect/token`

| grant_type | Paraméterek |
|------------|-------------|
| `password` | `username`, `password`, opcionálisan `device_token` |
| `refresh_token` | `refresh_token` |
| `authorization_code` | `code` |
| `mfa` | `mfa_token`, `code` (ugyanaz, mint `/connect/mfa/verify`) |

```http
POST /connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=password&username=teacher&password=titok&device_token=...
```

**Sikeres válasz (2FA nélkül, vagy trusted device):**

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
  "kreta:institute_code": "mockschool",
  "kreta:institute_user_id": "300",
  "kreta:user_name": "teacher",
  "name": "Kovács Béla",
  "role": "Tanar",
  "iat": 1710000000
}
```

**Role értékek:** `Tanulo` | `Tanar` | `Osztalyfonok`

Védett hívások:

```http
Authorization: Bearer <access_token>
```

---

## Kétfaktoros azonosítás (2FA)

Opcionális **TOTP** (Google / Microsoft Authenticator).  
**Csak** `Tanar` és `Osztalyfonok` role. Diáknak nincs.

### Belépési flow (ha 2FA be van kapcsolva)

1. `POST /connect/token` (`grant_type=password`) sikeres jelszó után:

```json
{
  "error": "mfa_required",
  "error_description": "Kétfaktoros azonosítás szükséges.",
  "mfa_token": "<rövid élettartamú token>"
}
```

2. Frontend: `/biztonsag/` oldal, 6 jegyű kód.
3. Ellenőrzés:

```http
POST /connect/mfa/verify
Content-Type: application/x-www-form-urlencoded

mfa_token=...&code=123456&device_token=...&trust_device=true
```

**Siker:** ugyanaz a token válasz, mint a password grantnél.  
Ha `trust_device=true`: válaszban `device_token` + ~30 napig nem kér 2FA-t ugyanarra az eszközre.

Helyreállító kód is küldhető a `code` mezőben (egyszer használható).

> **Fontos:** a password grant `mfa_required` ágához kell az `auth.go` MFA patch (`AfterPasswordCheckMFA`).

### Beállítás (bejelentkezés után, Bearer)

| Endpoint | Metódus | Leírás |
|----------|---------|--------|
| `/ellenorzo/v3/sajat/Mfa/Status` | GET | `{ available, enabled, role }` |
| `/ellenorzo/v3/sajat/Mfa/Setup` | GET/POST | Új TOTP secret + `otpauth://` URI (`enabled` még false) |
| `/ellenorzo/v3/sajat/Mfa/Enable` | POST | `{ "code": "123456" }` → bekapcsol + `recovery_code` |
| `/ellenorzo/v3/sajat/Mfa/Disable` | POST | `{ "password", "code" }` → kikapcsol |

**Setup válasz (példa):**

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "otpauth": "otpauth://totp/KRATA:teacher?secret=...&issuer=KRATA&digits=6&period=30",
  "issuer": "KRATA",
  "account": "teacher"
}
```

**Enable válasz:**

```json
{
  "success": true,
  "enabled": true,
  "recovery_code": "AB12CD34",
  "message": "2FA bekapcsolva..."
}
```

### UI

| URL | Szerep |
|-----|--------|
| https://puspus-dev.github.io/ujkreta/biztonsag/ | Beállítás (ha van token) **vagy** belépési kódkérés (ha van `mfa_token`) |

### curl – beállítás

```bash
BASE=https://ujkreta.onrender.com
TOKEN=$(curl -s -X POST "$BASE/connect/token" \
  -d "grant_type=password&username=OF_USER&password=OF_PASS" \
  | jq -r .access_token)

curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  "$BASE/ellenorzo/v3/sajat/Mfa/Setup" | jq

# Appba beolvasva a secret után:
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}' \
  "$BASE/ellenorzo/v3/sajat/Mfa/Enable" | jq
```

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

---

## E-ügyintézés – üzenetek

**Prefix:** `/integration-kretamobile-api/v1/kommunikacio`  
**Auth:** Bearer

| Metódus | Útvonal | Leírás |
|---------|---------|--------|
| GET | `/postaladaelemek/sajat` | Lista (`szoveg` max ~100 karakter) |
| GET | `/postaladaelemek/{id}` | Teljes üzenet |
| POST | `/uzenetek/olvasott` | `{ "isOlvasott": true, "uzenetAzonositoLista": [1001] }` |
| POST | `/uzenetek` | Küldés (mock): `targy`, `szoveg`, `cimzettUid`, `cimzettNev` |

Hiányzó id: HTTP **500**, body: `An error has occured!`  
Üres lista: `[]`.

UI: https://puspus-dev.github.io/ujkreta/eugyintezes/

---

## Osztályfőnök

- Role: **`Osztalyfonok`** (Admin → felhasználók).
- Belépés: fő login → `/osztalyfonok/`.
- Napló API: mint tanár.
- Extra (ha `of_role_patch` telepítve):

| Endpoint | Metódus | Leírás |
|----------|---------|--------|
| `/naplo/v3/sajat/Of/Diakok` | GET, POST, DELETE | Diákok |
| `/naplo/v3/sajat/Of/Users` | POST | Csak `Tanulo` user |

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

| HTTP / error | Jelentés |
|--------------|----------|
| 400 | Hibás kérés / JSON |
| 401 | Token / Basic Auth / hibás MFA kód |
| 401 + `mfa_required` | Jelszó OK, 2FA kód kell |
| 403 | Role nem elég |
| 405 | Method not allowed |
| 500 | Szerverhiba / hiányzó üzenet id |

---

## CORS

Engedélyezett originök tipikusan:

- `https://puspus-dev.github.io`
- `https://e-krata.github.io`
- `https://ekrata.ct.ws`
- `http://localhost:*` / `http://127.0.0.1:*` (dev)

---

## Health

```http
GET /health
→ { "status": "ok" }
```
