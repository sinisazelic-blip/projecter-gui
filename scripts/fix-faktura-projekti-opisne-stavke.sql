-- Dodaj opisne stavke u faktura_projekti (za wizard sub-items)
-- Pokreni: mysql -u USER -p DATABASE < scripts/fix-faktura-projekti-opisne-stavke.sql
-- Ako dobiješ "Duplicate column" grešku, kolona već postoji.

ALTER TABLE faktura_projekti
  ADD COLUMN opisne_stavke JSON NULL
  COMMENT 'Opisne sub-stavke (npr. TV voice over 20sec, prava korištenja 1 god)';
