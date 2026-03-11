-- Reset brojača faktura za 2026 (npr. nakon brisanja testnih faktura)
-- Cilj: sljedeći broj fakture bude 001/2026
--
-- VAŽNO:
-- - Ako u tabeli `fakture` već postoji zapis za 2026 sa `broj_u_godini` > 0,
--   sistem će i dalje uzeti MAX(broj_u_godini) + 1. Tada prvo obriši/renumeriši te test fakture.

START TRANSACTION;

INSERT INTO brojac_faktura (godina, zadnji_broj_u_godini)
VALUES (2026, 0)
ON DUPLICATE KEY UPDATE zadnji_broj_u_godini = 0;

COMMIT;

