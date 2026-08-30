-- Tanár implementáció – séma bővítések
-- Futtasd a meglévő schema.sql után, vagy illeszd bele.

-- Tanár profil a singleton store-ban
ALTER TABLE kreta_store
    ADD COLUMN IF NOT EXISTS teacher JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Felhasználói szerepkör
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Tanulo';

-- Index role-ra (opcionális)
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- Meglévő userek alapértelmezése
UPDATE users SET role = 'Tanulo' WHERE role IS NULL OR role = '';
