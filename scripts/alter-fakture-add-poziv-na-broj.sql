-- Poziv na broj (8 cifara) na fakturi – za automatsko uparivanje uplata pri importu izvoda.
-- Ako kolona već postoji, preskoči ovaj ALTER.

ALTER TABLE fakture
  ADD COLUMN poziv_na_broj VARCHAR(16) NULL DEFAULT NULL COMMENT '8 cifara, za uparivanje uplata';

-- Opciono: indeks za brzi lookup pri match-u
-- ALTER TABLE fakture ADD INDEX idx_fakture_poziv_na_broj (poziv_na_broj);
