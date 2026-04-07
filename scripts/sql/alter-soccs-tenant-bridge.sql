-- SOCCS / SwimVoice most na master Flux bazi (jedan izvor istine za tenant + aktivacijske kodove).
-- Pokreni ručno na MySQL masteru prije deploya verify API-ja.

-- Stabilan javni ID tenanta (šalje se u SOCCS kao tenant_id string)
ALTER TABLE tenants
  ADD COLUMN tenant_public_id CHAR(36) NULL COMMENT 'UUID za SOCCS verify odgovor' AFTER tenant_id;

UPDATE tenants SET tenant_public_id = UUID() WHERE tenant_public_id IS NULL;

ALTER TABLE tenants
  MODIFY tenant_public_id CHAR(36) NOT NULL,
  ADD UNIQUE KEY uq_tenants_public_id (tenant_public_id);

-- Paket SOCCS (Basic / Basic+ / Pro / Ent) – ne mijenja Flux plan (Light/Full), to je odvojeno
ALTER TABLE tenants
  ADD COLUMN soccs_tier VARCHAR(32) NULL DEFAULT 'BASIC'
    COMMENT 'BASIC|BASIC_PLUS|PROFESSIONAL|ENTERPRISE' AFTER currency;

UPDATE tenants SET soccs_tier = 'BASIC' WHERE soccs_tier IS NULL OR soccs_tier = '';

-- Opciono: savez (pokrovitelj) za meet – samo za Pro/Ent scenarije u UI-ju
ALTER TABLE tenants
  ADD COLUMN soccs_federation_parent_tenant_id INT NULL
    COMMENT 'FK na tenants.tenant_id – savez pod čijim okriljem je ovaj tenant (meet organizator)',
  ADD INDEX idx_tenants_soccs_federation (soccs_federation_parent_tenant_id),
  ADD CONSTRAINT fk_tenants_soccs_federation
    FOREIGN KEY (soccs_federation_parent_tenant_id) REFERENCES tenants (tenant_id) ON DELETE SET NULL;

-- Aktivacijski kodovi (prva instalacija + meet sesija)
CREATE TABLE IF NOT EXISTS soccs_activation_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL COMMENT 'Organizator / zakupac (FIRST_INSTALL ili meet red)',
  sponsor_tenant_id INT NULL COMMENT 'Savez – pokrovitelj (MEET_SESSION)',
  code VARCHAR(64) NOT NULL,
  purpose VARCHAR(24) NOT NULL COMMENT 'FIRST_INSTALL|MEET_SESSION',
  status VARCHAR(20) NOT NULL DEFAULT 'ISSUED' COMMENT 'ISSUED|CONSUMED|REVOKED',
  valid_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid_until DATETIME NULL,
  max_uses INT NOT NULL DEFAULT 1,
  uses_count INT NOT NULL DEFAULT 0,
  consumed_installation_id VARCHAR(64) NULL COMMENT 'SOCCS installation_public_id nakon prvog uspjeha',
  meet_note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_soccs_activation_codes_code (code),
  INDEX idx_sac_tenant (tenant_id),
  INDEX idx_sac_sponsor (sponsor_tenant_id),
  CONSTRAINT fk_sac_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_sac_sponsor FOREIGN KEY (sponsor_tenant_id) REFERENCES tenants (tenant_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
