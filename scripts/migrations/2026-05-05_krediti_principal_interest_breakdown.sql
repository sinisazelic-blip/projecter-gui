-- Krediti: razdvajanje glavnice i kamate/troškova
-- Pokreni:
-- mysql -u USER -p DATABASE < scripts/migrations/2026-05-05_krediti_principal_interest_breakdown.sql

SET @has_principal := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'krediti'
    AND column_name = 'iznos_kredita'
);
SET @sql_principal := IF(
  @has_principal = 0,
  'ALTER TABLE krediti ADD COLUMN iznos_kredita DECIMAL(12,2) NULL AFTER naziv',
  'SELECT 1'
);
PREPARE stmt_principal FROM @sql_principal;
EXECUTE stmt_principal;
DEALLOCATE PREPARE stmt_principal;

SET @has_interest := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'krediti'
    AND column_name = 'iznos_kamata_troskovi'
);
SET @sql_interest := IF(
  @has_interest = 0,
  'ALTER TABLE krediti ADD COLUMN iznos_kamata_troskovi DECIMAL(12,2) NULL AFTER iznos_kredita',
  'SELECT 1'
);
PREPARE stmt_interest FROM @sql_interest;
EXECUTE stmt_interest;
DEALLOCATE PREPARE stmt_interest;

UPDATE krediti
SET
  iznos_kredita = COALESCE(iznos_kredita, ukupan_iznos),
  iznos_kamata_troskovi = COALESCE(iznos_kamata_troskovi, 0.00);
