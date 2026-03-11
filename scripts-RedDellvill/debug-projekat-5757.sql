-- ============================================================
-- Projekat 5757 – pregled budžeta u bazi i moguće ispravke
-- Pokreni u MySQL/MariaDB (npr. HeidiSQL, DBeaver). Zamijeni 5757 ako treba.
-- ============================================================

SET @projekat_id = 5757;
SET @eur_to_bam = 1.95583;

-- 1) Koji Deal (inicijacija) je vezan za ovaj projekat?
SELECT
  i.inicijacija_id,
  i.radni_naziv,
  i.projekat_id,
  i.narucilac_id,
  i.krajnji_klijent_id,
  i.updated_at
FROM inicijacije i
WHERE i.projekat_id = @projekat_id;

-- 2) Svi snapshoti budžeta za ovaj projekat (redoslijed)
SELECT
  s.snapshot_id,
  s.projekat_id,
  s.inicijacija_id,
  (SELECT COUNT(*) FROM projekat_stavke ps WHERE ps.projekat_id = s.projekat_id AND ps.snapshot_id = s.snapshot_id) AS broj_stavki
FROM projekat_budget_snapshots s
WHERE s.projekat_id = @projekat_id
ORDER BY s.snapshot_id ASC;

-- 3) Stavke u projektu – SVE (svi snapshoti), da vidiš šta se zbraja
SELECT
  ps.projekat_id,
  ps.snapshot_id,
  ps.inicijacija_id,
  ps.inicijacija_stavka_id,
  ps.naziv,
  ps.kolicina,
  ps.cijena_jedinicna,
  ps.valuta,
  ps.line_total,
  CASE
    WHEN UPPER(COALESCE(ps.valuta,'')) = 'EUR' THEN ROUND(ps.line_total * @eur_to_bam, 2)
    ELSE ps.line_total
  END AS line_total_u_bam
FROM projekat_stavke ps
WHERE ps.projekat_id = @projekat_id
ORDER BY ps.snapshot_id ASC, ps.inicijacija_stavka_id ASC;

-- 4) Samo NAJNOVIJI snapshot (onaj koji aplikacija koristi za prikaz budžeta)
SELECT
  ps.snapshot_id,
  ps.inicijacija_stavka_id,
  ps.naziv,
  ps.kolicina,
  ps.cijena_jedinicna,
  ps.valuta,
  ps.line_total,
  CASE WHEN UPPER(COALESCE(ps.valuta,'')) = 'EUR' THEN ROUND(ps.line_total * @eur_to_bam, 2) ELSE ps.line_total END AS u_bam
FROM projekat_stavke ps
INNER JOIN (
  SELECT projekat_id, MAX(IFNULL(snapshot_id,0)) AS max_snap
  FROM projekat_stavke
  WHERE projekat_id = @projekat_id
  GROUP BY projekat_id
) ls ON ls.projekat_id = ps.projekat_id AND IFNULL(ps.snapshot_id,0) = ls.max_snap
WHERE ps.projekat_id = @projekat_id
ORDER BY ps.inicijacija_stavka_id;

-- 5) Zbir za najnoviji snapshot (kako aplikacija računa budžet)
SELECT
  ROUND(SUM(
    CASE
      WHEN UPPER(COALESCE(ps.valuta, 'BAM')) IN ('BAM','KM') THEN COALESCE(ps.line_total,0)
      WHEN UPPER(COALESCE(ps.valuta, '')) = 'EUR' THEN COALESCE(ps.line_total,0) * @eur_to_bam
      ELSE 0
    END
  ), 2) AS budzet_km_iz_baze,
  ROUND(SUM(CASE WHEN UPPER(COALESCE(ps.valuta,'')) = 'EUR' THEN COALESCE(ps.line_total,0) ELSE 0 END), 2) AS suma_eur,
  ROUND(SUM(CASE WHEN UPPER(COALESCE(ps.valuta,'BAM')) IN ('BAM','KM') THEN COALESCE(ps.line_total,0) ELSE 0 END), 2) AS suma_bam
FROM projekat_stavke ps
INNER JOIN (
  SELECT projekat_id, MAX(IFNULL(snapshot_id,0)) AS max_snap
  FROM projekat_stavke
  WHERE projekat_id = @projekat_id
  GROUP BY projekat_id
) ls ON ls.projekat_id = ps.projekat_id AND IFNULL(ps.snapshot_id,0) = ls.max_snap
WHERE ps.projekat_id = @projekat_id;

-- 6) Trenutne stavke u Deal-u (inicijacija) za ovaj projekat – da usporediš s projektom
SELECT
  ist.inicijacija_stavka_id,
  ist.inicijacija_id,
  ist.naziv_snapshot,
  ist.kolicina,
  ist.cijena_jedinicna,
  ist.valuta,
  ist.line_total,
  ist.stornirano
FROM inicijacija_stavke ist
WHERE ist.inicijacija_id = (SELECT inicijacija_id FROM inicijacije WHERE projekat_id = @projekat_id LIMIT 1)
ORDER BY ist.inicijacija_stavka_id;

-- ========== OPCIONO: Ispravke (koristi samo ako znaš šta mijenjaš) ==========

-- A) Ako su u projekat_stavke pogrešno upisane stavke u BAM umjesto EUR,
--    možeš postaviti valuta='EUR' za najnoviji snapshot (prilagodi snapshot_id iz upita 2):
/*
UPDATE projekat_stavke
SET valuta = 'EUR'
WHERE projekat_id = @projekat_id
  AND snapshot_id = (SELECT MAX(IFNULL(snapshot_id,0)) FROM projekat_stavke WHERE projekat_id = @projekat_id);
*/

-- B) Ako želiš obrisati SVE osim jednog snapshota (npr. zadržati samo najnoviji):
--    Prvo iz upita 2 vidi snapshot_id koji želiš zadržati, npr. 123.
/*
DELETE FROM projekat_stavke
WHERE projekat_id = @projekat_id AND snapshot_id <> 123;

DELETE FROM projekat_budget_snapshots
WHERE projekat_id = @projekat_id AND snapshot_id <> 123;
*/

-- C) Ručna ispravka valute/iznosa za najnoviji snapshot (prvo iz upita 2 uzmi snapshot_id):
--    Zamijeni @snap_id s stvarnim snapshot_id, npr. 123.
/*
SET @snap_id = (SELECT MAX(IFNULL(snapshot_id,0)) FROM projekat_stavke WHERE projekat_id = @projekat_id);
UPDATE projekat_stavke
SET valuta = 'EUR', line_total = 250.00, cijena_jedinicna = 250.00, kolicina = 1
WHERE projekat_id = @projekat_id AND IFNULL(snapshot_id,0) = @snap_id;
*/
