-- Brisanje testnih projekata od projekat_id 5754 nadalje (uključujući "TEST Projekat 2026 (UI)").
-- Backup baze, pa pokreni. Ako dobiješ FK grešku, prvo obriši zavisnosti (projektni_troskovi, projekat_faze, faktura_projekti) za projekat_id >= 5754.

START TRANSACTION;

DELETE FROM projekti WHERE projekat_id >= 5754;

COMMIT;
-- ROLLBACK;  -- ako želiš samo probati, zakomentiraj COMMIT i pokreni ROLLBACK
