-- Fix: Proširi kolonu source da prihvati EUR_XML_V2 (INO izvode)
-- Greška: "Data truncated for column 'source' at row 1"
-- Pokreni: mysql -u user -p database < scripts/alter-bank-import-source.sql

ALTER TABLE bank_import_batch
  MODIFY COLUMN source VARCHAR(30) NOT NULL;
