-- Postavke fiskalnog uređaja po firmi (L-PFR / Esir tip).
-- Jedan red po firma_id. Aktivna firma = firma_profile.is_active = 1.

CREATE TABLE IF NOT EXISTS firma_fiskal_settings (
  firma_id INT NOT NULL PRIMARY KEY,
  base_url VARCHAR(500) NULL COMMENT 'Base URL uređaja npr. http://192.168.x.x:3566/',
  api_path VARCHAR(255) NULL COMMENT 'Putanja API-ja npr. /api/v3/invoices ili /invoice',
  api_key VARCHAR(255) NULL COMMENT 'EsirKey / API ključ (hex)',
  pin VARCHAR(100) NULL COMMENT 'PIN; prazno = ručni unos na uređaju',
  use_external_printer TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = koristi eksterni štampač',
  external_printer_name VARCHAR(200) NULL COMMENT 'EsirExtStampac',
  external_printer_width INT NULL COMMENT 'EsirExtSirina, širina u znakovima',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_fiskal_firma FOREIGN KEY (firma_id) REFERENCES firma_profile(firma_id) ON DELETE CASCADE
);
