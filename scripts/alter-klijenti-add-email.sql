-- Dodaj kolonu email u šifarnik Klijent (klijenti).
-- Pokreni u bazi prije korištenja polja Email u Studio → Klijenti.

ALTER TABLE klijenti
  ADD COLUMN email VARCHAR(255) NULL DEFAULT NULL
  COMMENT 'Email klijenta (kontakt, slanje ponuda/faktura)'
  AFTER drzava;
