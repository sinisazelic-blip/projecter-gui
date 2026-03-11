-- Lista projekata od projekat_id 5700 na više (da odlučite od kojeg ID-a brisati testne)
-- Pokreni u MySQL klijentu. Kad odlučiš granicu, koristi clean-2026-test-projekti.sql (obriši od ID xxxx nadalje).

SELECT
  p.projekat_id     AS id,
  p.radni_naziv     AS naziv,
  sp.naziv_statusa  AS status,
  p.created_at      AS created_at
FROM projekti p
JOIN statusi_projekta sp ON sp.status_id = p.status_id
WHERE p.projekat_id >= 5700
ORDER BY p.projekat_id ASC;
