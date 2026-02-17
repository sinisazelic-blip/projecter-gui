-- Fix: users tabela – dodavanje kolona koje Korisnici modul očekuje
-- Greška: Unknown column 'password' in 'field list'
-- Pokreni: mysql -u USER -p DATABASE < scripts/fix-users-table.sql
-- IF NOT EXISTS zahteva MySQL 8.0.29+

-- password – za login (plain text; za produkciju preporučuje se hash)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255) NULL;
UPDATE users SET password = '' WHERE password IS NULL;
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NOT NULL DEFAULT '';

-- role_id, aktivan, last_login_at – ako nedostaju (preskače ako već postoje)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS aktivan TINYINT NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL;

-- radnik_id – povezivanje korisnika (login) sa šifarnikom radnici (opciono)
-- Ako već imaš kolonu, preskoči ovaj red (ili dobiješ Duplicate column).
ALTER TABLE users ADD COLUMN radnik_id INT NULL;
