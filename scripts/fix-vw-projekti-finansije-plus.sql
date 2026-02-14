-- Obriši pokvareni view vw_projekti_finansije_plus
-- Referencira kolone koje vw_projekti_finansije nema (radni_naziv, troskovi_novi_placeni, itd.)
-- View se ne koristi u aplikaciji — sigurno za brisanje
-- Pokreni u MySQL Workbench ili: mysql -u USER -p -h HOST -P 25060 studio_db < scripts/fix-vw-projekti-finansije-plus.sql

DROP VIEW IF EXISTS vw_projekti_finansije_plus;
