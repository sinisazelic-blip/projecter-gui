-- Povezivanje korisnika (users) sa šifarnikom radnici (opciono).
-- Studio → Korisnici koristi ovu kolonu za izbor "Radnik (osoba)" po loginu.
-- Pokreni jednom: mysql -u USER -p DATABASE < scripts-RedDellvill/add-users-radnik-id.sql
-- Ako kolona već postoji, dobit ćeš "Duplicate column" – to je u redu, preskoči.
ALTER TABLE users ADD COLUMN radnik_id INT NULL;
