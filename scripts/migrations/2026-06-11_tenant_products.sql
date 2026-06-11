-- Tenant centar: podrška za Pool Manager i DOCentre (isti mehanizam kao SOCCS)
-- + veza tenant ↔ klijent (naplata licence kroz Fluxa fakturisanje).
-- Pokreće se SAMO na master bazi (studio_db).
-- mysql -u USER -p DATABASE < scripts/migrations/2026-06-11_tenant_products.sql

ALTER TABLE soccs_activation_codes
  ADD COLUMN app VARCHAR(20) NOT NULL DEFAULT 'SOCCS'
    COMMENT 'SOCCS|POOL_MANAGER|DOCENTRE — kojoj aplikaciji kod pripada' AFTER purpose,
  ADD INDEX idx_sac_app (app);

ALTER TABLE tenants
  ADD COLUMN klijent_id INT NULL
    COMMENT 'FK na klijenti — naplata tenant licence kroz Fluxa fakturisanje' AFTER naziv,
  ADD INDEX idx_tenants_klijent (klijent_id);
