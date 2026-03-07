-- =============================================================================
-- Radnici: dodaj created_at i updated_at (ako ne postoje)
-- Potrebno da u popup-u (SISTEM) prikažemo kad je radnik kreiran i kad ažuriran.
-- =============================================================================
--
-- Kako pokrenuti u MySQL Workbench:
--   1. File → Open SQL Script → izaberi ovaj fajl
--   2. Označi samo ALTER naredbe (bez ovih komentara), pa Execute (grom)
--   3. Ako dobiješ "Duplicate column name" — kolone već postoje, sve je OK.
--
-- Ako i dalje vidiš "—" u popup-u: postojeći redovi možda imaju NULL.
-- Pokreni provjeru: SELECT radnik_id, created_at, updated_at FROM radnici LIMIT 5;
-- Opciono: popuni NULL za stare redove (created_at = datum sada, updated_at ostaje NULL):
--   UPDATE radnici SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
--
-- =============================================================================

ALTER TABLE radnici ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE radnici ADD COLUMN updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP;
