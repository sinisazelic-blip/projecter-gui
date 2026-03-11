-- Tabela za audit log (događaji kao onboarding_completed).
-- Potrebna da Fluxa tour ostane „samo jednom” – nakon Skip/Finish upisuje se zapis, /api/auth/me ga čita.
-- Pokreni na bazi (iste instance koja služi auth i tenant admin).

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event VARCHAR(80) NOT NULL,
  payload_json TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_log_event (event),
  INDEX idx_audit_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
