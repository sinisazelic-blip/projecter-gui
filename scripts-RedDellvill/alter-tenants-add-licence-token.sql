-- Dodaj licence_token tenantu – klijentska Fluxa šalje ga pri „licence check” prema masteru.
-- Pokreni na MASTER bazi (studio_db). Nakon toga za svaki tenant generiši token (ili kroz Licence UI).

ALTER TABLE tenants
  ADD COLUMN licence_token VARCHAR(64) NULL UNIQUE COMMENT 'Token za licence-check; klijent ga šalje u Authorization header',
  ADD INDEX idx_tenants_licence_token (licence_token);

-- Opciono: postavi token za postojeće tenante (Studio TAF i ostale). Možeš i iz Licence UI generisati.
-- UPDATE tenants SET licence_token = LOWER(CONCAT(SUBSTRING(MD5(RAND()), 1, 16), SUBSTRING(MD5(RAND()), 1, 16))) WHERE licence_token IS NULL;
