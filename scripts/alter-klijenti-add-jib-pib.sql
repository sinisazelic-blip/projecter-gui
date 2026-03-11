-- Dodaj JIB i PIB u šifarnik Klijent (klijenti).
-- PU zahtijeva isključivo JIB (13 cifara) u polju ID kupca; PIB ima 12 cifara.
-- Za INO kupce na fiskalni uređaj šaljemo 13×9 (9999999999999).
-- Pokreni u bazi ako kolone još ne postoje.

-- JIB (13 cifara) – koristi se za fiskalni uređaj (obavezno za BiH kupce)
ALTER TABLE klijenti
  ADD COLUMN jib VARCHAR(20) NULL DEFAULT NULL
  COMMENT 'JIB (13 cifara) – za fiskalni uređaj i identifikaciju'
  AFTER porezni_id;

-- PIB (12 cifara) – samo za prikaz/arhivu, ne šalje se na PU
ALTER TABLE klijenti
  ADD COLUMN pib VARCHAR(20) NULL DEFAULT NULL
  COMMENT 'PIB (12 cifara) – ne koristiti na fiskalnom uređaju'
  AFTER jib;

-- Opciono: prepiši porezni_id u jib ako izgleda kao JIB (13 cifara)
-- UPDATE klijenti SET jib = TRIM(REGEXP_REPLACE(porezni_id, '[^0-9]', '')) WHERE jib IS NULL AND LENGTH(TRIM(REGEXP_REPLACE(COALESCE(porezni_id,''), '[^0-9]', ''))) = 13;
