-- proJECTer – Faze projekta, radnici, deadline, % izvršenosti
-- Pokreni: mysql -u USER -p DATABASE < scripts/create-projekat-faze.sql
--
-- Preduvjet: tabele projekti i radnici moraju postojati.
-- radne_faze: opciono (ako ne postoji, faza_id ostaje samo broj).
--
-- Faze se prikazuju paralelno. deadline NULL = koristi projekti.rok_glavni.

-- 1. Faze projekta
-- Napomena: FK na radne_faze nije uključen (može radne_faze ne postojati).
-- faza_id se koristi za lookup u radne_faze ako postoji.
CREATE TABLE IF NOT EXISTS projekat_faze (
  projekat_faza_id INT NOT NULL AUTO_INCREMENT,
  projekat_id INT NOT NULL,
  faza_id INT NULL,
  naziv VARCHAR(255) NULL,
  datum_pocetka DATE NULL,
  datum_kraja DATE NULL,
  deadline DATE NULL,
  procenat_izvrsenosti DECIMAL(5,2) NOT NULL DEFAULT 0,
  redoslijed INT NOT NULL DEFAULT 0,
  napomena TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (projekat_faza_id),
  KEY idx_projekat_faze_projekat (projekat_id),
  KEY idx_projekat_faze_faza (faza_id),
  KEY idx_projekat_faze_deadline (deadline),
  CONSTRAINT fk_projekat_faze_projekat FOREIGN KEY (projekat_id)
    REFERENCES projekti(projekat_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Zaduženje radnika po fazi (N:N)
-- Napomena: Bez FK na radnici (radnik_id može biti drugog tipa u postojećoj bazi).
CREATE TABLE IF NOT EXISTS projekat_faza_radnici (
  projekat_faza_id INT NOT NULL,
  radnik_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (projekat_faza_id, radnik_id),
  KEY idx_pfr_faza (projekat_faza_id),
  KEY idx_pfr_radnik (radnik_id),
  CONSTRAINT fk_pfr_faza FOREIGN KEY (projekat_faza_id)
    REFERENCES projekat_faze(projekat_faza_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
