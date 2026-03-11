-- Brisanje test fakture 030/2026 + reset brojača za 2026 na 0 (sljedeća = 001/2026)
--
-- Pretpostavke:
-- - MySQL
-- - tabela: fakture (kolone: faktura_id, godina, broj_u_godini, ...)
-- - tabela: faktura_projekti (kolone: faktura_id, projekat_id, ...)
-- - tabela: projekti (kolone: projekat_id, status_id, ...)
-- - tabela: project_audit (kolone: projekat_id, action, details (JSON), ...)
-- - tabela: brojac_faktura (kolone: godina, zadnji_broj_u_godini)
--
-- ⚠️ Ova skripta je NAMJENJENA SAMO ako je 030/2026 test i želiš da ga ukloniš.
--    Ako je 030/2026 već “pravi” račun (poslan klijentu), NEMOJ brisati – radi se storno/knjiženje.

START TRANSACTION;

-- 1) Nađi fakturu 030/2026
SET @GODINA := 2026;
SET @BROJ_U_GODINI := 30;

SELECT f.faktura_id, f.godina, f.broj_u_godini
INTO @FAKTURA_ID, @G, @B
FROM fakture f
WHERE f.godina = @GODINA
  AND f.broj_u_godini = @BROJ_U_GODINI
LIMIT 1;

-- Ako @FAKTURA_ID bude NULL, nema šta brisati (provjeri da li je broj stvarno 030/2026)
SELECT @FAKTURA_ID AS faktura_id_found;

-- 2) Vrati projekte vezane za tu fakturu nazad na "Zatvoren" (8)
-- (Create fakture ih prebacuje na 9 = Fakturisan)
UPDATE projekti p
JOIN faktura_projekti fp ON fp.projekat_id = p.projekat_id
SET p.status_id = 8
WHERE fp.faktura_id = @FAKTURA_ID
  AND p.status_id = 9;

-- 3) Obriši audit zapise za fakturisanje koji referenciraju ovu fakturu
-- Primarno preko JSON_EXTRACT, fallback preko LIKE (ako je details string).
DELETE FROM project_audit
WHERE action = 'PROJECT_INVOICED'
  AND (
    (JSON_VALID(details) AND CAST(JSON_EXTRACT(details, '$.faktura_id') AS UNSIGNED) = @FAKTURA_ID)
    OR details LIKE CONCAT('%\"faktura_id\":', @FAKTURA_ID, '%')
  );

-- 4) Obriši veze faktura-projekti
DELETE FROM faktura_projekti WHERE faktura_id = @FAKTURA_ID;

-- 5) Obriši fakturu
DELETE FROM fakture WHERE faktura_id = @FAKTURA_ID;

-- 6) Reset brojača na 0 za 2026 (sljedeća = 001/2026),
-- ali samo ako nema nijedne druge fakture u 2026 (sigurnosni uslov kroz WHERE).
UPDATE brojac_faktura bf
SET bf.zadnji_broj_u_godini = 0
WHERE bf.godina = @GODINA
  AND (SELECT COALESCE(MAX(broj_u_godini), 0) FROM fakture WHERE godina = @GODINA) = 0;

-- Ako red u brojac_faktura ne postoji, upiši ga (opet samo ako nema faktura u 2026)
INSERT INTO brojac_faktura (godina, zadnji_broj_u_godini)
SELECT @GODINA, 0
WHERE NOT EXISTS (SELECT 1 FROM brojac_faktura WHERE godina = @GODINA)
  AND (SELECT COALESCE(MAX(broj_u_godini), 0) FROM fakture WHERE godina = @GODINA) = 0;

COMMIT;

-- Kontrola: treba da vrati 0
SELECT COALESCE(MAX(broj_u_godini), 0) AS max_broj_u_godini_2026 FROM fakture WHERE godina = 2026;
SELECT godina, zadnji_broj_u_godini FROM brojac_faktura WHERE godina = 2026;

