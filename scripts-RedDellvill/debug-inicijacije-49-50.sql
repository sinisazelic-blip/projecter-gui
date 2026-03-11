-- Inicijacije 49 i 50 + projekti + stavke (bez varijabli – trebalo bi vratiti redove)

-- 1) Inicijacije 49 i 50 (Deal-ovi)
SELECT
  inicijacija_id,
  radni_naziv,
  projekat_id,
  narucilac_id,
  krajnji_klijent_id,
  updated_at
FROM inicijacije
WHERE inicijacija_id IN (49, 50);

-- 2) Stavke u Deal-u 49 (stornirana) i 50
SELECT
  inicijacija_stavka_id,
  inicijacija_id,
  naziv_snapshot,
  kolicina,
  cijena_jedinicna,
  valuta,
  line_total,
  COALESCE(stornirano, 0) AS stornirano
FROM inicijacija_stavke
WHERE inicijacija_id IN (49, 50)
ORDER BY inicijacija_id, inicijacija_stavka_id;

-- 3) Zbir po Deal-u (50 bi trebao biti 250 EUR = 488,96 BAM)
-- Ako nema kolone stornirano, izbaci uvjet: AND (stornirano IS NULL OR stornirano = 0)
SELECT
  inicijacija_id,
  valuta,
  SUM(line_total) AS suma_line_total,
  COUNT(*) AS broj_stavki
FROM inicijacija_stavke
WHERE inicijacija_id IN (49, 50)
GROUP BY inicijacija_id, valuta
ORDER BY inicijacija_id, valuta;

-- 4) Snapshoti za projekat koji je vezan na inicijaciju 50
SELECT
  s.snapshot_id,
  s.projekat_id,
  s.inicijacija_id
FROM projekat_budget_snapshots s
WHERE s.projekat_id = (SELECT projekat_id FROM inicijacije WHERE inicijacija_id = 50 LIMIT 1)
ORDER BY s.snapshot_id;

-- 5) SVE stavke u projektu koji je vezan na inicijaciju 50 (sve snapshot-e)
SELECT
  ps.projekat_id,
  ps.snapshot_id,
  ps.inicijacija_id,
  ps.inicijacija_stavka_id,
  ps.naziv,
  ps.kolicina,
  ps.cijena_jedinicna,
  ps.valuta,
  ps.line_total
FROM projekat_stavke ps
WHERE ps.projekat_id = (SELECT projekat_id FROM inicijacije WHERE inicijacija_id = 50 LIMIT 1)
ORDER BY ps.snapshot_id, ps.inicijacija_stavka_id;

-- 6) Zbir u projektu (zašto 570) – po snapshotu
SELECT
  ps.snapshot_id,
  ps.inicijacija_id,
  SUM(CASE WHEN UPPER(COALESCE(ps.valuta,'')) = 'EUR' THEN ps.line_total * 1.95583 ELSE ps.line_total END) AS budzet_km,
  SUM(CASE WHEN UPPER(COALESCE(ps.valuta,'')) = 'EUR' THEN ps.line_total ELSE 0 END) AS suma_eur,
  SUM(CASE WHEN UPPER(COALESCE(ps.valuta,'BAM')) IN ('BAM','KM') THEN ps.line_total ELSE 0 END) AS suma_bam
FROM projekat_stavke ps
WHERE ps.projekat_id = (SELECT projekat_id FROM inicijacije WHERE inicijacija_id = 50 LIMIT 1)
GROUP BY ps.snapshot_id, ps.inicijacija_id
ORDER BY ps.snapshot_id;
