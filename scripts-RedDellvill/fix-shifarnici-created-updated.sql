-- Šifarnici: created_at i updated_at
-- Kreirano = kad je stavka dodata, Updated = kad je izmijenjena
-- Pokreni: mysql -u USER -p DATABASE < scripts/fix-shifarnici-created-updated.sql
--
-- Ako kolona već postoji: "Duplicate column name" — preskoči tu liniju i nastavi.
-- Pokreni svaku ALTER posebno ako treba.

-- klijenti
ALTER TABLE klijenti ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE klijenti ADD COLUMN updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP;

-- dobavljaci
ALTER TABLE dobavljaci ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE dobavljaci ADD COLUMN updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP;

-- talenti
ALTER TABLE talenti ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE talenti ADD COLUMN updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP;

-- cjenovnik_stavke
ALTER TABLE cjenovnik_stavke ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cjenovnik_stavke ADD COLUMN updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP;

-- ============================================================
-- Ako kolone već postoje ali imaju NULL (npr. bez DEFAULT):
-- Pokreni MODIFY da postaviš DEFAULT za buduće INSERT-ove.
-- Postojeći redovi ostaju NULL dok ih ne izmijeniš (updated_at
-- će se postaviti pri prvom UPDATE-u).
-- ============================================================
-- ALTER TABLE klijenti MODIFY created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
-- ALTER TABLE klijenti MODIFY updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP;
-- (isto za dobavljaci, talenti, cjenovnik_stavke)
