-- ============================================================
-- Multi-user e-napló séma bővítés
-- Illeszd a meglévő schema.sql végére / migráld Renderen.
-- ============================================================

-- Felhasználói szerepkör
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Tanulo';

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- Több diák (nem csak a singleton kreta_store.student)
CREATE TABLE IF NOT EXISTS students (
    uid TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    class_group_uid TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students (class_group_uid);
CREATE INDEX IF NOT EXISTS idx_students_data ON students USING GIN (data);

-- Tanárok
CREATE TABLE IF NOT EXISTS teachers (
    uid TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Jegyekhez / mulasztásokhoz diák UID a JSON-ban is (TanuloUid),
-- plusz indexelhető oszlop a szűréshez
ALTER TABLE grades
    ADD COLUMN IF NOT EXISTS student_uid TEXT;

ALTER TABLE omissions
    ADD COLUMN IF NOT EXISTS student_uid TEXT;

ALTER TABLE homework
    ADD COLUMN IF NOT EXISTS class_group_uid TEXT;

ALTER TABLE tests
    ADD COLUMN IF NOT EXISTS class_group_uid TEXT;

ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS class_group_uid TEXT;

CREATE INDEX IF NOT EXISTS idx_grades_student ON grades (student_uid);
CREATE INDEX IF NOT EXISTS idx_omissions_student ON omissions (student_uid);
CREATE INDEX IF NOT EXISTS idx_homework_class ON homework (class_group_uid);
CREATE INDEX IF NOT EXISTS idx_tests_class ON tests (class_group_uid);
CREATE INDEX IF NOT EXISTS idx_lessons_class ON lessons (class_group_uid);

-- Tanár profil a store singletonban (opcionális, backward compat)
ALTER TABLE kreta_store
    ADD COLUMN IF NOT EXISTS teacher JSONB NOT NULL DEFAULT '{}'::jsonb;
