-- Ispravi datume izdavanja faktura 2026 koje su pogrešno upisane s današnjim datumom.
-- Korak 1: Lista svih faktura 2026 (pregled)
-- Korak 2: Lista samo onih s današnjim datumom (one koje treba popraviti)
-- Korak 3: UPDATE primjeri – zamijeni datum i faktura_id prema svojoj listi

-- ========== 1. SVE FAKTURE 2026 (redoslijed po broju) ==========
SELECT
  f.faktura_id,
  f.broj_u_godini,
  CONCAT(LPAD(f.broj_u_godini, 3, '0'), '/', f.godina) AS broj_fakture,
  f.datum_izdavanja,
  k.naziv_klijenta AS narucilac,
  k.rok_placanja_dana
FROM fakture f
LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
WHERE f.godina = 2026
ORDER BY f.broj_u_godini ASC;

-- ========== 2. SAMO FAKTURE S DANAŠNJIM DATUMOM (one za ispravku) ==========
SELECT
  f.faktura_id,
  f.broj_u_godini,
  CONCAT(LPAD(f.broj_u_godini, 3, '0'), '/', f.godina) AS broj_fakture,
  f.datum_izdavanja AS trenutni_datum_izdavanja,
  k.naziv_klijenta AS narucilac
FROM fakture f
LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
WHERE f.godina = 2026
  AND DATE(f.datum_izdavanja) = CURDATE()
ORDER BY f.broj_u_godini ASC;

-- ========== 2b. DIJAGNOSTIKA: u kojoj bazi si i šta UPDATE zaista radi ==========
-- Pokreni ovo u istom Workbenchu gdje vidiš listu faktura.
SELECT DATABASE() AS trenutna_baza;

-- Kolone tabele fakture (provjera imena):
-- SHOW COLUMNS FROM fakture;

-- Jedan test UPDATE za 002/2026 – odmah zatim SELECT istog reda (u istom bloku).
UPDATE fakture SET datum_izdavanja = '2026-01-28' WHERE godina = 2026 AND broj_u_godini = 2;

SELECT faktura_id, broj_u_godini, datum_izdavanja
FROM fakture
WHERE godina = 2026 AND broj_u_godini = 2;
-- Ako ovdje već vidiš 2026-01-28, UPDATE radi – problem je možda da gledaš listu iz aplikacije ili drugog connectiona.
-- Ako i dalje vidiš 2026-03-10, provjeri: Rows matched / Rows changed ispod UPDATE-a (0 = ne pogađa nijedan red).

-- ========== 3. SVI UPDATE-i (pokreni nakon što 2b potvrdi da UPDATE radi) ==========
START TRANSACTION;

UPDATE fakture SET datum_izdavanja = '2026-01-28' WHERE godina = 2026 AND broj_u_godini = 2;
UPDATE fakture SET datum_izdavanja = '2026-02-01' WHERE godina = 2026 AND broj_u_godini = 3;
UPDATE fakture SET datum_izdavanja = '2026-02-03' WHERE godina = 2026 AND broj_u_godini = 4;
UPDATE fakture SET datum_izdavanja = '2026-02-25' WHERE godina = 2026 AND broj_u_godini = 5;
UPDATE fakture SET datum_izdavanja = '2026-02-25' WHERE godina = 2026 AND broj_u_godini = 6;
UPDATE fakture SET datum_izdavanja = '2026-03-01' WHERE godina = 2026 AND broj_u_godini = 7;

COMMIT;
