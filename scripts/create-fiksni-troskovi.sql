-- Fiksni troškovi (pretplate, zakupi, porezi…)
-- Pokreni: mysql -u USER -p DATABASE < scripts/create-fiksni-troskovi.sql

CREATE TABLE IF NOT EXISTS fiksni_troskovi (
  trosak_id INT NOT NULL AUTO_INCREMENT,
  naziv_troska VARCHAR(255) NOT NULL,
  frekvencija ENUM('MJESECNO', 'GODISNJE', 'JEDNOKRATNO') NOT NULL DEFAULT 'MJESECNO',
  dan_u_mjesecu TINYINT NULL COMMENT '1-31 za mjesečne',
  datum_dospijeca DATE NULL COMMENT 'za godišnje/jednokratne',
  zadnje_placeno DATE NULL,
  rok_tolerancije_dana INT NULL DEFAULT 0,
  iznos DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  valuta VARCHAR(10) NOT NULL DEFAULT 'BAM',
  nacin_placanja VARCHAR(100) NULL,
  automatski TINYINT NOT NULL DEFAULT 0,
  aktivan TINYINT NOT NULL DEFAULT 1,
  napomena TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (trosak_id),
  KEY idx_fiksni_aktivan (aktivan),
  KEY idx_fiksni_frekvencija (frekvencija)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
