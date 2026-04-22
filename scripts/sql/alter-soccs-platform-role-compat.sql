-- Kompatibilna migracija za starije MySQL verzije (bez ADD COLUMN IF NOT EXISTS).
-- Dodaje kolone samo ako ne postoje.

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_soccs_platform_role $$
CREATE PROCEDURE migrate_soccs_platform_role()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tenants'
      AND COLUMN_NAME = 'soccs_platform_role'
  ) THEN
    ALTER TABLE tenants
      ADD COLUMN soccs_platform_role VARCHAR(24) NULL
      COMMENT 'Globalna uloga za SOCCS access: OWNER|AMBASSADOR'
      AFTER soccs_tier;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tenants'
      AND COLUMN_NAME = 'soccs_platform_scope'
  ) THEN
    ALTER TABLE tenants
      ADD COLUMN soccs_platform_scope TEXT NULL
      COMMENT 'Scope za platformsku ulogu: "*" ili CSV tenant_public_id vrijednosti'
      AFTER soccs_platform_role;
  END IF;

  UPDATE tenants
  SET soccs_platform_role = NULL
  WHERE soccs_platform_role IS NOT NULL
    AND UPPER(TRIM(soccs_platform_role)) NOT IN ('OWNER', 'AMBASSADOR');
END $$

CALL migrate_soccs_platform_role() $$
DROP PROCEDURE migrate_soccs_platform_role $$

DELIMITER ;
