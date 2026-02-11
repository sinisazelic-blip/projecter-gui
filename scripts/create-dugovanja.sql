-- Dugovanja (obaveze prema dobavljačima, talentima…)
-- Pokreni: mysql -u USER -p DATABASE < scripts/create-dugovanja.sql
-- Zrcano od Potraživanja (projekt_potrazivanja)

-- 1. Glavna tabela
CREATE TABLE IF NOT EXISTS projekt_dugovanja (
  dugovanje_id INT NOT NULL AUTO_INCREMENT,
  projekat_id INT NULL,
  dobavljac_id INT NULL COMMENT 'FK na dobavljaci.dobavljac_id',
  talent_id INT NULL COMMENT 'FK na talenti.talent_id',
  datum DATE NULL,
  datum_dospijeca DATE NULL,
  iznos DECIMAL(12, 2) NULL,
  valuta VARCHAR(10) NOT NULL DEFAULT 'BAM',
  iznos_km DECIMAL(12, 2) NULL,
  opis VARCHAR(500) NULL,
  napomena TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'CEKA' COMMENT 'CEKA/PLACENO/DJELIMICNO/STORNO',
  placeno_datum DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (dugovanje_id),
  KEY idx_dug_projekat (projekat_id),
  KEY idx_dug_dobavljac (dobavljac_id),
  KEY idx_dug_status (status),
  KEY idx_dug_dospijeca (datum_dospijeca)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Link tabela (dugovanje -> plaćanje)
CREATE TABLE IF NOT EXISTS projekt_dugovanje_placanje_link (
  link_id INT NOT NULL AUTO_INCREMENT,
  dugovanje_id INT NOT NULL,
  placanje_id BIGINT NOT NULL,
  amount_km DECIMAL(12, 2) NOT NULL DEFAULT 0,
  aktivan TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (link_id),
  UNIQUE KEY uk_dug_plac (dugovanje_id, placanje_id),
  KEY idx_dug_link_dug (dugovanje_id),
  KEY idx_dug_link_plac (placanje_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. View za sumu plaćenog (analogno v_potrazivanja_paid_sum)
DROP VIEW IF EXISTS v_dugovanja_paid_sum;
CREATE VIEW v_dugovanja_paid_sum AS
SELECT
  l.dugovanje_id,
  SUM(CASE WHEN l.aktivan = 1 THEN l.amount_km ELSE 0 END) AS paid_km
FROM projekt_dugovanje_placanje_link l
WHERE l.aktivan = 1
GROUP BY l.dugovanje_id;
