-- Prikaz računa na fakturama (po računu).
-- Pokreni na master bazi prije deploya izmjena Firma-Postavke modula.

ALTER TABLE firma_bank_accounts
  ADD COLUMN show_on_invoice TINYINT(1) NOT NULL DEFAULT 1
  COMMENT '1=prikazi na fakturama, 0=sakrij';

