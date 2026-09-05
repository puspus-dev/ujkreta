# ujkreta – diák multi-user javítások

## Kötelező csere a repóban

1. **student_api.go** – nincs singleton fallback (nem Csenge-be dob)
2. **static/admin/app.js** (és admin/app.js) – mentéskor NEM hívja a PUT /admin/student-et

## Opcionális / ha még nincs kint

- teacher_store.go – összes diák a tanár listában
- teacher_students_fix.go – jegy/mulasztás törlés
- teacher.go – DELETE grades/omissions
- server.go – admin users/students hard delete + upsert

## Deploy

git add student_api.go static/admin/
git commit -m "fix: multi student without singleton overwrite"
git push

Admin UI: GitHub Pages static/admin frissítése.
