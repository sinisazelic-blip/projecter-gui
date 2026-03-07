-- =============================================================================
-- Radne faze: dodaj created_at i updated_at (ako ne postoje)
-- Da u popup-u "Promijeni radnu fazu" (SISTEM) prikažemo Kreirano i Ažurirano.
-- =============================================================================
--
-- Kako pokrenuti u MySQL Workbench:
--   1. File → Open SQL Script → izaberi ovaj fajl
--   2. Označi samo ALTER naredbe (bez komentara), pa Execute (grom)
--   3. "Duplicate column name" = kolone već postoje, u redu.
--
-- Ako i dalje vidiš "—": postojeći redovi imaju NULL. Opciono popuni:
--   UPDATE radne_faze SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
--
-- =============================================================================

ALTER TABLE radne_faze ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE radne_faze ADD COLUMN updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP;
