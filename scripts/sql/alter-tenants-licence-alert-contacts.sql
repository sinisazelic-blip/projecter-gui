-- Kontakt za upozorenja o licenci + dedup zadnjeg slanja (Studio master / tenants).
-- Za idempotentan način: npm run migrate:licence-alert-contacts
-- (vidi scripts/run-migration-tenant-licence-alert-contacts.cjs)

ALTER TABLE tenants
  ADD COLUMN billing_email VARCHAR(255) NULL
    COMMENT 'Email za licence / upozorenja (Studio ručno ili User zone)'
    AFTER studio_licence_profile,
  ADD COLUMN billing_phone VARCHAR(64) NULL
    COMMENT 'Telefon za SMS (opciono, kad se uvede provajder)'
    AFTER billing_email,
  ADD COLUMN last_licence_alert_at DATETIME NULL
    COMMENT 'Zadnji put kad je poslato bilo koje licence upozorenje'
    AFTER billing_phone,
  ADD COLUMN last_licence_alert_key VARCHAR(191) NULL
    COMMENT 'Potpis stanja (dedup iste poruke dok se stanje ne promijeni)'
    AFTER last_licence_alert_at;
