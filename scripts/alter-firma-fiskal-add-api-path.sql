-- Opciona putanja API-ja za fiskalni uređaj (npr. JP Aquana koristi drugu od /api/v3/invoices).
-- Ako je NULL, koristi se podrazumijevano /api/v3/invoices.

ALTER TABLE firma_fiskal_settings
  ADD COLUMN api_path VARCHAR(255) NULL COMMENT 'npr. /api/v3/invoices ili /invoice'
  AFTER base_url;
