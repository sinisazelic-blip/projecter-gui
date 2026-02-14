-- Izlazne fakture (fakture koje izdajemo klijentima)
-- Pokreni: mysql -u USER -p DATABASE < scripts/create-fakture.sql

CREATE TABLE IF NOT EXISTS fakture (
  faktura_id INT NOT NULL AUTO_INCREMENT,
  -- Broj fakture (format: 001/2026)
  broj_fakture VARCHAR(50) NOT NULL UNIQUE COMMENT 'Format: 001/2026',
  godina INT NOT NULL COMMENT 'Godina fakture (za reset brojača)',
  broj_u_godini INT NOT NULL COMMENT 'Broj fakture u godini (001, 002, ...)',
  
  -- Fiskalni broj (PFR) - kontinuiran, ne resetuje se
  broj_fiskalni INT NULL COMMENT 'PFR broj (poslednji + 1)',
  
  -- Datumi
  datum_izdavanja DATE NOT NULL,
  datum_dospijeca DATE NULL COMMENT 'Izračunat: datum_izdavanja + rok_placanja_dana',
  
  -- Klijent/Naručioc
  narucilac_id INT NOT NULL COMMENT 'FK klijenti.klijent_id',
  
  -- Finansije
  iznos_bez_pdv DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  pdv_iznos DECIMAL(12, 2) NULL COMMENT 'PDV iznos (ako ima)',
  iznos_sa_pdv DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  valuta VARCHAR(10) NOT NULL DEFAULT 'BAM',
  
  -- Poziv na broj (8 cifara)
  poziv_na_broj VARCHAR(8) NULL COMMENT '8-cifreni poziv na broj',
  
  -- Projekti (može biti više projekata na jednoj fakturi)
  projekti_ids TEXT NULL COMMENT 'Comma-separated projekat_id lista',
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'KREIRANA' COMMENT 'KREIRANA/PLACENA/DJELIMICNO/STORNO',
  
  -- Napomena
  napomena TEXT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (faktura_id),
  UNIQUE KEY uk_faktura_broj (broj_fakture),
  KEY idx_faktura_godina (godina),
  KEY idx_faktura_narucilac (narucilac_id),
  KEY idx_faktura_datum (datum_izdavanja),
  KEY idx_faktura_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Brojač faktura po godini (za generisanje broja fakture)
CREATE TABLE IF NOT EXISTS brojac_faktura (
  godina INT NOT NULL PRIMARY KEY,
  zadnji_broj_u_godini INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Veza faktura-projekti (za multi-projekt fakture)
CREATE TABLE IF NOT EXISTS faktura_projekti (
  faktura_id INT NOT NULL,
  projekat_id INT NOT NULL,
  PRIMARY KEY (faktura_id, projekat_id),
  KEY idx_fp_projekat (projekat_id),
  FOREIGN KEY (faktura_id) REFERENCES fakture(faktura_id) ON DELETE CASCADE,
  FOREIGN KEY (projekat_id) REFERENCES projekti(projekat_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
