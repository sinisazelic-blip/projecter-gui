-- Popust prije PDV-a (KM) na ponudi – za wizard i pregovore
ALTER TABLE ponude
  ADD COLUMN popust_km DECIMAL(12, 2) NULL DEFAULT NULL
  COMMENT 'Popust u KM (umanjenje osnovice prije PDV-a)'
  AFTER valuta;
