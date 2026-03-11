-- Postavi datum troškova (projektni_troskovi.datum_troska) na datum izdavanja fakture
-- za projekte koji su na fakturama 002–007/2026. Mijenjaju se samo troškovi koji
-- trenutno imaju današnji datum (pogrešno uneseni).

-- ========== 1. PREGLED: koji su projekti na kojim fakturama i koji datum fakture ==========
SELECT
  f.broj_u_godini,
  CONCAT(LPAD(f.broj_u_godini, 3, '0'), '/', f.godina) AS broj_fakture,
  f.datum_izdavanja AS datum_fakture,
  fp.projekat_id,
  (SELECT COUNT(*) FROM projektni_troskovi pt WHERE pt.projekat_id = fp.projekat_id AND DATE(pt.datum_troska) = CURDATE()) AS troskova_s_danas
FROM fakture f
JOIN faktura_projekti fp ON fp.faktura_id = f.faktura_id
WHERE f.godina = 2026 AND f.broj_u_godini IN (2, 3, 4, 5, 6, 7)
ORDER BY f.broj_u_godini, fp.projekat_id;

-- ========== 2. DRY RUN: koliko će redova biti ažurirano ==========
SELECT COUNT(*) AS broj_troskova_za_izmjenu
FROM projektni_troskovi pt
JOIN faktura_projekti fp ON fp.projekat_id = pt.projekat_id
JOIN fakture f ON f.faktura_id = fp.faktura_id AND f.godina = 2026 AND f.broj_u_godini IN (2, 3, 4, 5, 6, 7)
WHERE DATE(pt.datum_troska) = CURDATE();

-- ========== 3. UPDATE: datum_troska = datum_izdavanja fakture (samo troškovi s današnjim datumom) ==========
-- Ako skriptu pokreneš drugi dan, zamijeni CURDATE() s datumom koji su troškovi imali (npr. '2026-03-10').
START TRANSACTION;

UPDATE projektni_troskovi pt
JOIN faktura_projekti fp ON fp.projekat_id = pt.projekat_id
JOIN fakture f ON f.faktura_id = fp.faktura_id AND f.godina = 2026 AND f.broj_u_godini IN (2, 3, 4, 5, 6, 7)
SET pt.datum_troska = f.datum_izdavanja
WHERE DATE(pt.datum_troska) = CURDATE();

COMMIT;
-- Ako nešto nije u redu: ROLLBACK;
