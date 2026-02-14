-- Dodaj naziv_na_fakturi u faktura_projekti (override naziv projekta na fakturi)
-- Pokreni: mysql -u USER -p DATABASE < scripts/fix-faktura-projekti-naziv-na-fakturi.sql
-- Ako dobiješ "Duplicate column" grešku, kolona već postoji.

ALTER TABLE faktura_projekti
  ADD COLUMN naziv_na_fakturi VARCHAR(500) NULL
  COMMENT 'Override naziv projekta na štampi fakture (iz wizarda korak 2)';
