-- Tabela za „korisnik je prošao onboarding” – jedan red po user_id.
-- GET /api/auth/me koristi je da vrati onboarding_completed: true i tura se više ne prikazuje.
-- Pokreni na bazi (iste instance koja služi auth).

CREATE TABLE IF NOT EXISTS onboarding_completed (
  user_id INT NOT NULL PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
