-- KUF (Knjiga ulaznih faktura) – ulazne fakture sa rasknjižavanjem
-- Pokreni: mysql -u USER -p DATABASE < scripts/create-kuf-ulazne-fakture.sql

-- Tip rasknjižavanja: gdje ide trošak
-- PROJEKTNI_TROSAK = projektni trošak (dobavljač) → projekat
-- FIKSNI_TROSAK = fiksni trošak (pretplate, zakupi…)
-- VANREDNI_TROSAK = servis, repro materijal, potrošni materijal
-- INVESTICIJE = oprema, uređaji, skuplje stvari

CREATE TABLE IF NOT EXISTS kuf_ulazne_fakture (
  kuf_id INT NOT NULL AUTO_INCREMENT,
  broj_fakture VARCHAR(100) NULL COMMENT 'Broj fakture dobavljača',
  datum_fakture DATE NOT NULL,
  datum_dospijeca DATE NULL,
  -- Partner (ko izdaje fakturu): dobavljač ili klijent iz naše baze
  dobavljac_id INT NULL COMMENT 'FK dobavljaci.dobavljac_id',
  klijent_id INT NULL COMMENT 'FK klijenti.klijent_id (ako je partner u klijentima)',
  partner_naziv VARCHAR(255) NULL COMMENT 'Ako nije u šifarniku',
  -- Iznos
  iznos DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  valuta VARCHAR(10) NOT NULL DEFAULT 'BAM',
  iznos_km DECIMAL(12, 2) NULL,
  kurs DECIMAL(12, 6) NULL COMMENT 'Ako nije BAM',
  -- Opis
  opis VARCHAR(500) NULL COMMENT 'Opis stavke',
  napomena TEXT NULL,
  -- Rasknjižavanje
  tip_rasknjizavanja ENUM('PROJEKTNI_TROSAK', 'FIKSNI_TROSAK', 'VANREDNI_TROSAK', 'INVESTICIJE') NOT NULL,
  projekat_id INT NULL COMMENT 'Za PROJEKTNI_TROSAK',
  fiksni_trosak_id INT NULL COMMENT 'Za FIKSNI_TROSAK',
  vanredni_podtip VARCHAR(50) NULL COMMENT ' Za VANREDNI: SERVIS, REPRO_MATERIJAL, POTROSNI_MATERIJAL',
  investicija_opis VARCHAR(255) NULL COMMENT 'Za INVESTICIJE: šta je',
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'CEKA' COMMENT 'CEKA/PLACENO/DJELIMICNO/STORNO',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (kuf_id),
  KEY idx_kuf_datum (datum_fakture),
  KEY idx_kuf_dobavljac (dobavljac_id),
  KEY idx_kuf_klijent (klijent_id),
  KEY idx_kuf_projekat (projekat_id),
  KEY idx_kuf_tip (tip_rasknjizavanja),
  KEY idx_kuf_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
