-- proJECTer – Šifarnici: kreiranje tabela
-- Pokreni: mysql -u USER -p DATABASE < scripts/create-shifarnici-tables.sql
-- ili iz MySQL klijenta: SOURCE scripts/create-shifarnici-tables.sql;

-- 1. Radne faze
CREATE TABLE IF NOT EXISTS radne_faze (
  faza_id INT NOT NULL AUTO_INCREMENT,
  naziv VARCHAR(255) NOT NULL,
  opis_poslova TEXT NULL,
  slozenost_posla VARCHAR(100) NULL,
  vrsta_posla VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (faza_id),
  KEY idx_radne_faze_naziv (naziv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Users (korisnici)
-- Napomena: Za produkciju preporučuje se hashovanje lozinke (npr. bcrypt)
CREATE TABLE IF NOT EXISTS users (
  user_id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  grupa VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uk_users_username (username),
  KEY idx_users_grupa (grupa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Roles (uloge)
CREATE TABLE IF NOT EXISTS roles (
  role_id INT NOT NULL AUTO_INCREMENT,
  naziv VARCHAR(255) NOT NULL,
  nivo_ovlastenja INT NULL DEFAULT 0,
  opis TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id),
  KEY idx_roles_naziv (naziv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Radnici
CREATE TABLE IF NOT EXISTS radnici (
  radnik_id INT NOT NULL AUTO_INCREMENT,
  ime VARCHAR(255) NOT NULL,
  prezime VARCHAR(255) NOT NULL,
  adresa VARCHAR(500) NULL,
  broj_telefona VARCHAR(100) NULL,
  email VARCHAR(255) NULL,
  datum_rodjenja DATE NULL,
  jib VARCHAR(20) NULL,
  aktivan TINYINT NOT NULL DEFAULT 1,
  opis TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (radnik_id),
  KEY idx_radnici_ime_prezime (ime, prezime),
  KEY idx_radnici_aktivan (aktivan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
