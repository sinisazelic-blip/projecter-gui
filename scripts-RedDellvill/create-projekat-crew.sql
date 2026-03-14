-- projekat_crew: Account Manager + Crew članovi
-- Account Manager = onaj koji je otvorio projekat (iz users.radnik_id pri Otvori projekat)
-- Crew = radnici/saradnici koji mogu pristupiti projektu (max 12)
--
-- Pokreni: mysql -u USER -p DATABASE < scripts-RedDellvill/create-projekat-crew.sql

-- 1. Account Manager u projekti
-- Pokreni redom; ako kolona/ključ već postoji, preskoči taj red.
ALTER TABLE projekti ADD COLUMN account_manager_radnik_id INT NULL;
ALTER TABLE projekti ADD KEY idx_projekti_account_manager (account_manager_radnik_id);

-- 2. Crew članovi (N:N projekat <-> radnik)
CREATE TABLE IF NOT EXISTS projekat_crew (
  projekat_id INT NOT NULL,
  radnik_id INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (projekat_id, radnik_id),
  KEY idx_projekat_crew_projekat (projekat_id),
  KEY idx_projekat_crew_radnik (radnik_id),
  CONSTRAINT fk_projekat_crew_projekat FOREIGN KEY (projekat_id)
    REFERENCES projekti(projekat_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
