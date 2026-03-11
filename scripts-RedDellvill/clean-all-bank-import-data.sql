-- ============================================================
-- CLEAN: Bankovni izvodi + bank import staging/match/postings
-- Cilj: potpuno "čist" ponovni import izvoda da Fluxa pokaže pravo stanje.
--
-- Šta briše:
-- - Legacy import: bank_transakcije
-- - Novi import v2: bank_import_batch, bank_tx_staging, bank_tx_match, bank_tx_posting,
--   bank_tx_cost_link, bank_transactions
-- - Izvedeni entiteti nastali iz linkova:
--   - projektni_troskovi (preko bank_tx_cost_link.trosak_row_id)
--   - projektni_prihodi (preko bank_tx_posting_prihod_link)
--   - placanja (preko bank_tx_posting_placanje_link)
-- - Link tabele: bank_tx_posting_prihod_link, bank_tx_posting_placanje_link
--
-- Šta NE briše (default):
-- - Pravila matchovanja: bank_tx_match_rule (ostavljamo da ostane znanje)
--
-- PREPORUKA:
-- 1) Napravi backup baze.
-- 2) Pokreni DRY RUN SELECT dio da vidiš brojeve.
-- 3) Pokreni u transakciji.
-- ============================================================

-- ======================
-- DRY RUN (COUNT)
-- ======================
SELECT 'bank_import_batch' AS tbl, COUNT(*) AS cnt FROM bank_import_batch
UNION ALL SELECT 'bank_tx_staging', COUNT(*) FROM bank_tx_staging
UNION ALL SELECT 'bank_tx_match', COUNT(*) FROM bank_tx_match
UNION ALL SELECT 'bank_tx_posting', COUNT(*) FROM bank_tx_posting
UNION ALL SELECT 'bank_tx_cost_link', COUNT(*) FROM bank_tx_cost_link
UNION ALL SELECT 'bank_tx_posting_prihod_link', COUNT(*) FROM bank_tx_posting_prihod_link
UNION ALL SELECT 'bank_tx_posting_placanje_link', COUNT(*) FROM bank_tx_posting_placanje_link
UNION ALL SELECT 'bank_transactions', COUNT(*) FROM bank_transactions
UNION ALL SELECT 'bank_transakcije (legacy)', COUNT(*) FROM bank_transakcije;

-- Koliko "izvedenih" zapisa je povezano preko linkova
SELECT 'projektni_troskovi linked' AS tbl, COUNT(*) AS cnt
FROM projektni_troskovi pt
JOIN bank_tx_cost_link l ON l.trosak_row_id = pt.trosak_id
UNION ALL
SELECT 'projektni_prihodi linked', COUNT(*)
FROM projektni_prihodi pp
JOIN bank_tx_posting_prihod_link l ON l.prihod_id = pp.prihod_id
UNION ALL
SELECT 'placanja linked', COUNT(*)
FROM placanja p
JOIN bank_tx_posting_placanje_link l ON l.placanje_id = p.placanje_id;

-- ======================
-- IZVRŠENJE
-- ======================
-- START TRANSACTION;
-- SET FOREIGN_KEY_CHECKS = 0;

-- 1) Izvedeni entiteti (brišemo samo one koji su nastali iz linkovanja)
-- DELETE pt
-- FROM projektni_troskovi pt
-- JOIN bank_tx_cost_link l ON l.trosak_row_id = pt.trosak_id;

-- DELETE pp
-- FROM projektni_prihodi pp
-- JOIN bank_tx_posting_prihod_link l ON l.prihod_id = pp.prihod_id;

-- DELETE p
-- FROM placanja p
-- JOIN bank_tx_posting_placanje_link l ON l.placanje_id = p.placanje_id;

-- 2) Link tabele (tek nakon izvedenih, jer su nam linkovi trebali za JOIN)
-- DELETE FROM bank_tx_posting_prihod_link;
-- DELETE FROM bank_tx_posting_placanje_link;
-- DELETE FROM bank_tx_cost_link;

-- 3) Core bank tabele (v2)
-- DELETE FROM bank_tx_posting;
-- DELETE FROM bank_tx_match;
-- DELETE FROM bank_tx_staging;
-- DELETE FROM bank_import_batch;
-- DELETE FROM bank_transactions;

-- 4) Legacy (stari import)
-- DELETE FROM bank_transakcije;

-- 5) (OPCIONO) Obriši i pravila matchovanja ako su i ona bila testna
-- DELETE FROM bank_tx_match_rule;

-- Reset AUTO_INCREMENT (opciono, da id-evi krenu od 1)
-- ALTER TABLE bank_import_batch AUTO_INCREMENT = 1;
-- ALTER TABLE bank_tx_staging AUTO_INCREMENT = 1;
-- ALTER TABLE bank_tx_match AUTO_INCREMENT = 1;
-- ALTER TABLE bank_tx_posting AUTO_INCREMENT = 1;
-- ALTER TABLE bank_tx_cost_link AUTO_INCREMENT = 1;
-- ALTER TABLE bank_tx_posting_prihod_link AUTO_INCREMENT = 1;
-- ALTER TABLE bank_tx_posting_placanje_link AUTO_INCREMENT = 1;
-- ALTER TABLE bank_transactions AUTO_INCREMENT = 1;
-- ALTER TABLE bank_transakcije AUTO_INCREMENT = 1;

-- SET FOREIGN_KEY_CHECKS = 1;
-- COMMIT;
-- ili ROLLBACK;

