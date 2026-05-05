-- Proširenje fiksnih troškova:
-- 1) USD podrška (valuta je VARCHAR pa nije potreban ALTER za enum)
-- 2) Oznaka plaćanja: poslovni ili privatni račun
-- 3) Napomena za ručno knjiženje (npr. privatna uplata bez bank izvoda)
--
-- Pokreni:
-- mysql -u USER -p DATABASE < scripts/migrations/2026-05-05_fiksni_troskovi_usd_private_delete_support.sql

SET @has_nacin := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'fiksni_troskovi'
    AND column_name = 'nacin_placanja'
);
SET @sql_nacin := IF(
  @has_nacin = 0,
  'ALTER TABLE fiksni_troskovi ADD COLUMN nacin_placanja VARCHAR(100) NULL AFTER valuta',
  'SELECT 1'
);
PREPARE stmt_nacin FROM @sql_nacin;
EXECUTE stmt_nacin;
DEALLOCATE PREPARE stmt_nacin;

SET @has_napomena := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'fiksni_troskovi'
    AND column_name = 'napomena'
);
SET @sql_napomena := IF(
  @has_napomena = 0,
  'ALTER TABLE fiksni_troskovi ADD COLUMN napomena TEXT NULL AFTER automatski',
  'SELECT 1'
);
PREPARE stmt_napomena FROM @sql_napomena;
EXECUTE stmt_napomena;
DEALLOCATE PREPARE stmt_napomena;

UPDATE fiksni_troskovi
SET nacin_placanja = COALESCE(NULLIF(TRIM(nacin_placanja), ''), 'POSLOVNI_RACUN')
WHERE nacin_placanja IS NULL OR TRIM(nacin_placanja) = '';
