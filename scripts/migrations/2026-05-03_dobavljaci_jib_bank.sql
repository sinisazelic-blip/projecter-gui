-- Dobavljači: JIB (BiH) i bankovni podaci (INO: SWIFT, naziv i adresa banke)
-- mysql -u USER -p DATABASE < scripts/migrations/2026-05-03_dobavljaci_jib_bank.sql

ALTER TABLE dobavljaci
  ADD COLUMN jib VARCHAR(13) NULL COMMENT 'Jedinstveni identifikacioni broj (BiH), 13 cifara' AFTER napomena,
  ADD COLUMN bank_broj_racuna VARCHAR(64) NULL COMMENT 'Broj računa / IBAN za domaće' AFTER jib,
  ADD COLUMN bank_iban VARCHAR(64) NULL COMMENT 'IBAN (INO, opciono ako je u broju računa)' AFTER bank_broj_racuna,
  ADD COLUMN bank_swift VARCHAR(11) NULL COMMENT 'BIC/SWIFT za INO uplate' AFTER bank_iban,
  ADD COLUMN bank_naziv VARCHAR(255) NULL COMMENT 'Naziv banke (INO)' AFTER bank_swift,
  ADD COLUMN bank_adresa VARCHAR(500) NULL COMMENT 'Adresa banke (INO)' AFTER bank_naziv;
