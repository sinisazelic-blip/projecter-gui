-- Platformske uloge za SOCCS pristupe (OWNER / AMBASSADOR), odvojeno od tenant paketa.
-- Pokreni na master bazi prije deploya ažuriranog activation-verify endpointa.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS soccs_platform_role VARCHAR(24) NULL
    COMMENT 'Globalna uloga za SOCCS access: OWNER|AMBASSADOR' AFTER soccs_tier,
  ADD COLUMN IF NOT EXISTS soccs_platform_scope TEXT NULL
    COMMENT 'Scope za platformsku ulogu: "*" ili CSV tenant_public_id vrijednosti' AFTER soccs_platform_role;

UPDATE tenants
SET soccs_platform_role = NULL
WHERE soccs_platform_role IS NOT NULL
  AND UPPER(TRIM(soccs_platform_role)) NOT IN ('OWNER', 'AMBASSADOR');
