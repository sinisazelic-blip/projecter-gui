-- Dodaj kolonu logo_path u firma_profile ako ne postoji (za upload logotipa na fakturi)
-- Pokreni: mysql -u USER -p DATABASE < scripts/firma-logo-path.sql
-- Ako kolona već postoji: "Duplicate column" — preskoči.

ALTER TABLE firma_profile ADD COLUMN logo_path VARCHAR(512) NULL;
