-- Klijenti: flag "naručilac" — samo ovi klijenti se nude u polju 1 (bill-to) pri kreiranju novog Deala.
-- Inicijalno: 1 za sve koji su istorijski već bili naručioci (inicijacije / projekti), ostali 0.
-- mysql -u USER -p DATABASE < scripts/migrations/2026-06-11_klijenti_is_narucilac.sql

ALTER TABLE klijenti
  ADD COLUMN is_narucilac TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Klijent se nudi kao naručilac (bill-to) u novom Dealu' AFTER aktivan;

UPDATE klijenti k
SET k.is_narucilac = 1
WHERE EXISTS (SELECT 1 FROM inicijacije i WHERE i.narucilac_id = k.klijent_id)
   OR EXISTS (SELECT 1 FROM projekti p WHERE p.narucilac_id = k.klijent_id);
