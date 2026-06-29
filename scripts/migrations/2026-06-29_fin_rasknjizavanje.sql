-- Novi model knjiženja: fin_rasknjizavanje
-- Svaka alokacija = dio bank postinga (ili otpis tolerancije bez postinga) na poslovni objekat.

CREATE TABLE IF NOT EXISTS fin_rasknjizavanje (
  rasknjizavanje_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  posting_id BIGINT UNSIGNED NULL COMMENT 'NULL samo za OTPIS_TOLERANCIJE bez bank stavke',
  iznos_km DECIMAL(14, 2) NOT NULL,
  vrsta VARCHAR(40) NOT NULL COMMENT 'NAPLATA_FAKTURE|OTPIS_TOLERANCIJE|BANK_PROVIZIJA|ISPLATA_TROSKA|KREDIT_KLIJENTA|POCETNO_STANJE|KONVERZIJA|OSTALO',
  faktura_id INT UNSIGNED NULL,
  trosak_id INT UNSIGNED NULL,
  klijent_id INT UNSIGNED NULL,
  talent_id INT UNSIGNED NULL,
  dobavljac_id INT UNSIGNED NULL,
  projekat_id INT UNSIGNED NULL,
  prihod_id INT UNSIGNED NULL,
  placanje_id INT UNSIGNED NULL,
  napomena VARCHAR(500) NULL,
  aktivan TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rasknjizavanje_id),
  KEY idx_fin_rask_posting (posting_id, aktivan),
  KEY idx_fin_rask_faktura (faktura_id, aktivan),
  KEY idx_fin_rask_trosak (trosak_id, aktivan),
  KEY idx_fin_rask_klijent (klijent_id, aktivan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Partner tolerancija (Feelming: otpis razlike do X KM/EUR po klijentu)
CREATE TABLE IF NOT EXISTS fin_partner_tolerancija (
  tolerancija_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  partner_tip VARCHAR(20) NOT NULL COMMENT 'klijent|dobavljac|talent',
  partner_id INT UNSIGNED NOT NULL,
  max_iznos_km DECIMAL(14, 2) NOT NULL DEFAULT 25.00,
  valuta VARCHAR(8) NULL DEFAULT 'EUR',
  napomena VARCHAR(500) NULL,
  aktivan TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tolerancija_id),
  UNIQUE KEY uq_fin_tol_partner (partner_tip, partner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
