-- =============================================================================
-- EVENT (događaj): Status 3 "Čeka potvrdu klijenta" — više se ne koristi
-- =============================================================================
-- Kontekst: Posljedice razvoja Fluxe, bilo je dosta lutanja. Status 3
-- ("Čeka potvrdu klijenta") više ne koristimo u aktivnom flow-u.
--
-- Preimenujemo ga u "Service" (ili slično) kao placeholder za buduću upotrebu
-- ako se nečega sjetimo gdje bi nam taj status dobro došao.
-- Datum: 2025-02-11
-- =============================================================================

-- 1) Preimenuj status 3 u statusi_projekta
--    Stari: "Čeka potvrdu klijenta"
--    Novi:  "Service" (placeholder za buduću upotrebu)
UPDATE statusi_projekta
SET naziv_statusa = 'Service'
WHERE status_id = 3;

-- 2) Deal #11 → projekat #5767: postavi status na "Završen" (status_id = 7)
UPDATE projekti
SET status_id = 7
WHERE projekat_id = 5767;
