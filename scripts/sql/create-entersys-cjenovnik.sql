-- EnterSYS cjenovnik: lokalno BAM/KM, ino EUR i USD.
-- App sama kreira tabelu pri prvom otvaranju Licence (INSERT IGNORE seed).
-- Ovaj fajl je referenca / ručni fallback.

CREATE TABLE IF NOT EXISTS entersys_cjenovnik (
  stavka_key VARCHAR(40) NOT NULL,
  naziv VARCHAR(120) NOT NULL,
  module_key VARCHAR(40) NULL,
  vrsta VARCHAR(16) NOT NULL DEFAULT 'DODATAK',
  cijena_bam DECIMAL(12,2) NOT NULL DEFAULT 0,
  cijena_eur DECIMAL(12,2) NOT NULL DEFAULT 0,
  cijena_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  aktivan TINYINT NOT NULL DEFAULT 1,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (stavka_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
