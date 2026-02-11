-- Krediti – pregled kreditnih obaveza
-- Pokreni: mysql -u USER -p DATABASE < scripts/create-krediti.sql

CREATE TABLE IF NOT EXISTS krediti (
  kredit_id INT NOT NULL AUTO_INCREMENT,
  naziv VARCHAR(255) NOT NULL COMMENT 'npr. Auto kredit, Biznis kredit',
  ukupan_iznos DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  valuta VARCHAR(10) NOT NULL DEFAULT 'BAM',
  broj_rata INT NOT NULL DEFAULT 1,
  uplaceno_rata INT NOT NULL DEFAULT 0,
  iznos_rate DECIMAL(12, 2) NULL COMMENT 'Iznos po rati (ako jednake)',
  datum_posljednja_rata DATE NULL COMMENT 'Mjesec i godina posljednje rate',
  banka_naziv VARCHAR(255) NULL,
  aktivan TINYINT NOT NULL DEFAULT 1,
  napomena TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (kredit_id),
  KEY idx_krediti_aktivan (aktivan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
