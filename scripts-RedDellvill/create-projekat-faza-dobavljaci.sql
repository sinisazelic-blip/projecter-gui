-- proJECTer – Dobavljači po fazi projekta (N:N)
-- Pokreni: mysql -u USER -p DATABASE < scripts/create-projekat-faza-dobavljaci.sql
--
-- Preduvjet: tabele projekat_faze i dobavljaci moraju postojati.

CREATE TABLE IF NOT EXISTS projekat_faza_dobavljaci (
  projekat_faza_id INT NOT NULL,
  dobavljac_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (projekat_faza_id, dobavljac_id),
  KEY idx_pfd_faza (projekat_faza_id),
  KEY idx_pfd_dobavljac (dobavljac_id),
  CONSTRAINT fk_pfd_faza FOREIGN KEY (projekat_faza_id)
    REFERENCES projekat_faze(projekat_faza_id) ON DELETE CASCADE,
  CONSTRAINT fk_pfd_dobavljac FOREIGN KEY (dobavljac_id)
    REFERENCES dobavljaci(dobavljac_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
