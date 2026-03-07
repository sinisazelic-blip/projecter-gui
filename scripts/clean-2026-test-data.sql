-- Čišćenje testnih podataka iz 2026. godine
-- (izvode, fakture, ponude, Deals – NE brišemo projekte: import je iz 2026., ali su to 20 godina Studio TAF poslovanja; testne projekte brisati posebno)
--
-- NAPOMENA: Prije izvršenja preporučeno je:
-- 1. Backup baze.
-- 2. Pokrenuti samo SELECT (dry-run) dio da vidite šta će biti obrisano.
-- 3. Izvršiti u transakciji pa rollback ako nešto ne valja.

-- ========== DRY RUN: koliko redova će biti obrisano ==========
SELECT 'fakture (godina=2026)' AS entitet, COUNT(*) AS broj FROM fakture WHERE godina = 2026
UNION ALL
SELECT 'ponude (godina=2026)', COUNT(*) FROM ponude WHERE godina = 2026
UNION ALL
SELECT 'deal_timeline_events (za inicijacije 2026)', COUNT(*) FROM deal_timeline_events
  WHERE inicijacija_id IN (SELECT inicijacija_id FROM inicijacije WHERE created_at >= '2026-01-01')
UNION ALL
SELECT 'inicijacija_stavke (za inicijacije 2026)', COUNT(*) FROM inicijacija_stavke
  WHERE inicijacija_id IN (SELECT inicijacija_id FROM inicijacije WHERE created_at >= '2026-01-01')
UNION ALL
SELECT 'inicijacije (created 2026)', COUNT(*) FROM inicijacije WHERE created_at >= '2026-01-01'
UNION ALL
SELECT 'blagajna_stavke (datum ili created 2026)', COUNT(*) FROM blagajna_stavke
  WHERE datum >= '2026-01-01' OR created_at >= '2026-01-01';

-- ========== IZVRŠENJE (otkomentiraj nakon provjere) ==========
-- START TRANSACTION;

-- 1. Fakture 2026 (CASCADE obriše faktura_projekti za te fakture)
-- DELETE FROM fakture WHERE godina = 2026;

-- 2. Ponude 2026 (CASCADE obriše ponuda_stavke)
-- DELETE FROM ponude WHERE godina = 2026;

-- 3. Timeline događaji za Deals iz 2026
-- DELETE FROM deal_timeline_events
-- WHERE inicijacija_id IN (SELECT inicijacija_id FROM inicijacije WHERE created_at >= '2026-01-01');

-- 4. Stavke inicijacija (Deals) iz 2026
-- DELETE FROM inicijacija_stavke
-- WHERE inicijacija_id IN (SELECT inicijacija_id FROM inicijacije WHERE created_at >= '2026-01-01');

-- 5. Inicijacije (Deals) iz 2026
-- DELETE FROM inicijacije WHERE created_at >= '2026-01-01';

-- 6. Blagajna – stavke s datumom ili created_at u 2026. („izvodi“)
-- (Projekti se NE brišu ovdje – testne projekte obrisati posebno kad nađete kriterij.)
-- DELETE FROM blagajna_stavke WHERE datum >= '2026-01-01' OR created_at >= '2026-01-01';

-- COMMIT;
-- ili ROLLBACK; ako nešto nije u redu
--
-- Ako imate tabele uplate / fiskalni_dogadjaji po fakturi, prije koraka 1 dodajte:
-- DELETE FROM uplate WHERE faktura_id IN (SELECT faktura_id FROM fakture WHERE godina = 2026);
-- DELETE FROM fiskalni_dogadjaji WHERE faktura_id IN (SELECT faktura_id FROM fakture WHERE godina = 2026);
