-- Verzija Fluxe (plan) odvojena od broja korisnika; cijena za info.
-- Pokreni na MASTER bazi.

-- 1) Dodaj kolone tenantu
ALTER TABLE tenants
  ADD COLUMN max_users INT NOT NULL DEFAULT 5 COMMENT 'Limit korisnika (1, 3, 5, 10, 50, 100+)',
  ADD COLUMN monthly_price DECIMAL(10,2) NULL COMMENT 'Cijena mjesečno (samo info, ne računa se)',
  ADD COLUMN currency VARCHAR(3) NULL COMMENT 'Valuta npr. EUR, KM';

-- 2) Postavi max_users postojećim tenantima iz plana (ako već nije postavljeno)
UPDATE tenants t
JOIN plans p ON p.plan_id = t.plan_id
SET t.max_users = p.max_users
WHERE t.max_users = 5 AND p.max_users != 5;

-- 3) Dodaj planove Compact i Core ako ne postoje (UNIQUE na naziv)
INSERT IGNORE INTO plans (naziv, max_users, max_saradnici) VALUES
  ('Compact', 5, 2),
  ('Core', 1, 0);

-- Napomena: Redoslijed verzija u UI: Full, Compact, Light, Core (ORDER BY FIELD(naziv, 'Full', 'Compact', 'Light', 'Core') ili po plan_id).
