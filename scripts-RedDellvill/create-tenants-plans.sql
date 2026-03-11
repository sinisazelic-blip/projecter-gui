-- Tenant (organizacija / kupac licence) i planovi – po PLAN_AKTIVNOSTI_NAREDNI_PERIOD.md
-- Pokreni jednom na bazi (master instanca). Na klijentskim deploy-ima ove tabele ne moraju postojati.

-- Planovi (Light, Full, itd.)
CREATE TABLE IF NOT EXISTS plans (
  plan_id INT AUTO_INCREMENT PRIMARY KEY,
  naziv VARCHAR(80) NOT NULL,
  max_users INT NOT NULL DEFAULT 5,
  max_saradnici INT NOT NULL DEFAULT 0,
  features VARCHAR(500) NULL COMMENT 'JSON ili bitmask – koji moduli vidljivi',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_plans_naziv (naziv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tenanti (organizacije – kupci licence)
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id INT AUTO_INCREMENT PRIMARY KEY,
  naziv VARCHAR(255) NOT NULL,
  plan_id INT NOT NULL,
  subscription_starts_at DATE NOT NULL,
  subscription_ends_at DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'AKTIVAN' COMMENT 'AKTIVAN | ISTEKLO | SUSPENDOVAN',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenants_plan (plan_id),
  INDEX idx_tenants_ends (subscription_ends_at),
  INDEX idx_tenants_status (status),
  CONSTRAINT fk_tenants_plan FOREIGN KEY (plan_id) REFERENCES plans (plan_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed planovi (ako već nema redova)
INSERT IGNORE INTO plans (plan_id, naziv, max_users, max_saradnici) VALUES
  (1, 'Light', 3, 2),
  (2, 'Full', 10, 5);

-- Seed jedan tenant (Studio TAF – vaša instanca) ako ne postoji
INSERT INTO tenants (tenant_id, naziv, plan_id, subscription_starts_at, subscription_ends_at, status)
SELECT 1, 'Studio TAF', 2, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR), 'AKTIVAN'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM tenants LIMIT 1);
