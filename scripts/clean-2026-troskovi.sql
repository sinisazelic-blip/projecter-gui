-- Čišćenje projektnih troškova (talenti, dobavljači) iz 2026. – januar i februar (testni podaci).
-- Redoslijed: prvo placanja_stavke (FK na trosak_id), pa projektni_troskovi.
--
-- Prije izvršenja: backup baze. Opciono pokreni dry-run da vidiš brojke.

-- ========== DRY RUN ==========
SELECT 'placanja_stavke (za troškove jan–feb 2026)' AS entitet, COUNT(*) AS broj
  FROM placanja_stavke ps
  WHERE ps.trosak_id IN (
    SELECT trosak_id FROM projektni_troskovi
    WHERE datum_troska >= '2026-01-01' AND datum_troska < '2026-03-01'
  )
UNION ALL
SELECT 'projektni_troskovi (jan–feb 2026)', COUNT(*)
  FROM projektni_troskovi
  WHERE datum_troska >= '2026-01-01' AND datum_troska < '2026-03-01';

-- ========== IZVRŠENJE (otkomentiraj nakon provjere) ==========
-- START TRANSACTION;

-- 1. Stavke plaćanja vezane za troškove jan–feb 2026
-- DELETE FROM placanja_stavke
-- WHERE trosak_id IN (
--   SELECT trosak_id FROM projektni_troskovi
--   WHERE datum_troska >= '2026-01-01' AND datum_troska < '2026-03-01'
-- );

-- 2. Projektni troškovi (talenti, dobavljači) jan–feb 2026
-- DELETE FROM projektni_troskovi
-- WHERE datum_troska >= '2026-01-01' AND datum_troska < '2026-03-01';

-- COMMIT;
-- ROLLBACK;
