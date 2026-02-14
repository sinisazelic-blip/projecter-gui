-- Popuni created_at i updated_at gdje su NULL
-- Pokreni cijelu skriptu: mysql -u USER -p DATABASE < scripts/backfill-datumi.sql

UPDATE klijenti
SET created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL;

UPDATE dobavljaci
SET created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL;

UPDATE talenti
SET created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL;

UPDATE cjenovnik_stavke
SET created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL;
