-- Šifarnik fiksnih troškova: članarina i ostalo (idempotentno)
-- mysql -u USER -p DATABASE < scripts/migrations/2026-05-04_fiksni_troskovi_clanarina_ostalo.sql

INSERT INTO fiksni_troskovi
  (naziv_troska, frekvencija, dan_u_mjesecu, datum_dospijeca, iznos, valuta, aktivan)
SELECT 'Članarina', 'MJESECNO', 1, NULL, 0.00, 'BAM', 1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM fiksni_troskovi f WHERE LOWER(TRIM(f.naziv_troska)) = 'članarina' LIMIT 1
);

INSERT INTO fiksni_troskovi
  (naziv_troska, frekvencija, dan_u_mjesecu, datum_dospijeca, iznos, valuta, aktivan)
SELECT 'Ostalo', 'MJESECNO', 1, NULL, 0.00, 'BAM', 1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM fiksni_troskovi f WHERE LOWER(TRIM(f.naziv_troska)) = 'ostalo' LIMIT 1
);
