-- Dopuna projekt_statusi u demo bazi (API project-statuses): dodaj status_id 4..12 ako nedostaju.
-- Pokreni na demo bazi: mysql -u ... -p studio_db_demo < scripts-RedDellvill/fix-demo-projekt-statusi-1-12.sql

-- kod mora biti UNIQUE; stari seed ima (3, 'zatvoren'), pa 8 koristi 'zatvoren_soft'
INSERT IGNORE INTO projekt_statusi (status_id, kod, naziv, opis, sort, redoslijed) VALUES
(4, 'produkcija', 'Produkcija', NULL, 4, 4),
(5, 'produkcija_omega', 'Produkcija', NULL, 5, 5),
(6, 'postprodukcija', 'Postprodukcija', NULL, 6, 6),
(7, 'zavrsen', 'Završen', NULL, 7, 7),
(8, 'zatvoren_soft', 'Zatvoren', NULL, 8, 8),
(9, 'fakturisan', 'Fakturisan', NULL, 9, 9),
(10, 'arhiviran', 'Arhiviran', NULL, 10, 10),
(11, 'na_cekanju', 'Na čekanju', NULL, 11, 11),
(12, 'otkazan', 'Otkazan', NULL, 12, 12);
