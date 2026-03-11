-- Local VAT % (EU) — stopa za domaće fakture u EU regiji (npr. 19, 21)
-- Pokreni jednom na bazi prije korištenja Company Settings polja "Local VAT % (EU)".
ALTER TABLE firma_profile
  ADD COLUMN vat_rate_local DECIMAL(5,2) NULL
  COMMENT 'Postotak domaćeg PDV-a u EU (npr. 19, 21)';
