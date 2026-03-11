-- ============================================================
-- Čišćenje staging tablica (projekat_stavke, projekat_budget_snapshots)
-- Uklanja redove čiji projekat ili inicijacija više ne postoji u bazi.
-- Pokreni nakon čišćenja inicijacija/projekata da ne ostane "smeće" koje
-- projekat prikazuje kao budžet (npr. 570 KM umjesto 488,96).
-- ============================================================

-- 1) PREGLED: koliko će se obrisati (samo čitanje)
SELECT 'projekat_stavke - osirotele po projekat_id' AS opis, COUNT(*) AS broj
FROM projekat_stavke ps
LEFT JOIN projekti p ON p.projekat_id = ps.projekat_id
WHERE p.projekat_id IS NULL
UNION ALL
SELECT 'projekat_stavke - osirotele po inicijacija_id', COUNT(*)
FROM projekat_stavke ps
LEFT JOIN inicijacije i ON i.inicijacija_id = ps.inicijacija_id
WHERE i.inicijacija_id IS NULL
UNION ALL
SELECT 'projekat_budget_snapshots - osirotele po projekat_id', COUNT(*)
FROM projekat_budget_snapshots s
LEFT JOIN projekti p ON p.projekat_id = s.projekat_id
WHERE p.projekat_id IS NULL
UNION ALL
SELECT 'projekat_budget_snapshots - osirotele po inicijacija_id', COUNT(*)
FROM projekat_budget_snapshots s
LEFT JOIN inicijacije i ON i.inicijacija_id = s.inicijacija_id
WHERE i.inicijacija_id IS NULL;

-- 2) BRISANJE: prvo snapshoti, pa stavke (zbog eventualnog FK)
-- Osiroteli snapshoti (projekat ne postoji)
DELETE s FROM projekat_budget_snapshots s
LEFT JOIN projekti p ON p.projekat_id = s.projekat_id
WHERE p.projekat_id IS NULL;

-- Osiroteli snapshoti (inicijacija ne postoji)
DELETE s FROM projekat_budget_snapshots s
LEFT JOIN inicijacije i ON i.inicijacija_id = s.inicijacija_id
WHERE i.inicijacija_id IS NULL;

-- Osirotele stavke (projekat ne postoji)
DELETE ps FROM projekat_stavke ps
LEFT JOIN projekti p ON p.projekat_id = ps.projekat_id
WHERE p.projekat_id IS NULL;

-- Osirotele stavke (inicijacija ne postoji)
DELETE ps FROM projekat_stavke ps
LEFT JOIN inicijacije i ON i.inicijacija_id = ps.inicijacija_id
WHERE i.inicijacija_id IS NULL;

-- 3) OPCIONO: za projekat 5757 – obriši SVE njegove stavke i snapshot-e
--    da se budžet ponovno napuni samo iz trenutnog Deala (sync).
--    Koristi kad projekt pokazuje stari budžet (npr. 570), a Deal je ispravan (488,96).
--    Nakon brisanja, u aplikaciji otvori Deal 50 → Promijeni bilo koju stavku → Snimi;
--    to pokreće sync i projekt će dobiti novi snapshot s 250 EUR.
/*
DELETE FROM projekat_stavke WHERE projekat_id = 5757;
DELETE FROM projekat_budget_snapshots WHERE projekat_id = 5757;
*/
