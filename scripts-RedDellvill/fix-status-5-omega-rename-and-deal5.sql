-- =============================================================================
-- EVENT (događaj): Uklanjanje faze "U mjerenju Omega" iz Fluxe
-- =============================================================================
-- Kontekst: Na početku izgradnje Fluxe postojala je posebna faza za projekte
-- koji grupno donose novac studiju ("Omega"). To više nema smisla.
-- Fluxa će raditi i u drugim agencijama (Studio TAF u BiH je jedan od njih).
--
-- Ovaj event dokumentuje promjenu prije što se Fluxa koristi u drugim agencijama.
-- Datum: 2025-02-11
-- =============================================================================

-- 1) Preimenuj status 5 u statusi_projekta
--    Stari: "U mjerenju Omega" / "U mjerenju (Omega)"
--    Novi:  "Produkcija" (neutralno, bez Omega reference)
UPDATE statusi_projekta
SET naziv_statusa = 'Produkcija'
WHERE status_id = 5;

-- 2) Deal #5 → projekat #5758: postavi status na "U produkciji" (status_id = 4)
UPDATE projekti
SET status_id = 4
WHERE projekat_id = 5758;
