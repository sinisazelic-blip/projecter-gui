-- Migracija fakture tabele: kopiraj iznose u kolone koje API koristi
-- Pokreni: mysql -u USER -p DATABASE < scripts/fix-fakture-kolone-iznosi.sql
-- Koristi ako lista faktura prikazuje 0.00 umjesto stvarnih iznosa.
-- PRVO: SHOW COLUMNS FROM fakture; — provjeri da li imaš i osnovica_km i iznos_bez_pdv

-- Kopiraj iz stare u novu shemu (ako postoje obje)
UPDATE fakture SET osnovica_km = iznos_bez_pdv WHERE iznos_bez_pdv IS NOT NULL AND (osnovica_km IS NULL OR osnovica_km = 0);
UPDATE fakture SET pdv_iznos_km = pdv_iznos WHERE pdv_iznos IS NOT NULL AND (pdv_iznos_km IS NULL OR pdv_iznos_km = 0);
UPDATE fakture SET iznos_ukupno_km = iznos_sa_pdv WHERE iznos_sa_pdv IS NOT NULL AND (iznos_ukupno_km IS NULL OR iznos_ukupno_km = 0);
