-- Provjera: imaju li tabele created_at/updated_at i šta vraćaju
-- Pokreni: mysql -u USER -p DATABASE < scripts/debug-datumi.sql

SELECT 'klijenti' AS tbl, klijent_id, naziv_klijenta, created_at, updated_at FROM klijenti LIMIT 3;
SELECT 'dobavljaci' AS tbl, dobavljac_id, naziv, created_at, updated_at FROM dobavljaci LIMIT 3;
SELECT 'talenti' AS tbl, talent_id, ime_prezime, created_at, updated_at FROM talenti LIMIT 3;
SELECT 'cjenovnik_stavke' AS tbl, stavka_id, naziv, created_at, updated_at FROM cjenovnik_stavke LIMIT 3;
