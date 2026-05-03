-- KUF: eksplicitni ulazni PDV u KM (za domaće fakture i tačan obračun PDV prijave)
-- mysql -u USER -p DATABASE < scripts/migrations/2026-04-30_kuf_pdv_iznos_km.sql

ALTER TABLE kuf_ulazne_fakture
  ADD COLUMN pdv_iznos_km DECIMAL(12, 2) NULL
    COMMENT 'Ulazni PDV u KM (ručni unos; NULL/0 = bez ulaznog PDV-a u PDV prijavi)'
  AFTER iznos_km;
