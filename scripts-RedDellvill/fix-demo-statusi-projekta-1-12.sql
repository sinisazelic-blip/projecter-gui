-- Dopuna statusi_projekta u demo bazi (studio_db_demo): dodaj status_id 4..12 ako nedostaju.
-- FINAL OK zahtijeva status_id = 7, Close zahtijeva 7 pa onda 8.
-- Pokreni na demo bazi: mysql -u ... -p studio_db_demo < scripts-RedDellvill/fix-demo-statusi-projekta-1-12.sql

INSERT IGNORE INTO statusi_projekta (status_id, naziv_statusa, opis, redoslijed, aktivan, core_faza) VALUES
(4, 'Produkcija', 'Produkcija', 4, 1, 'active'),
(5, 'Produkcija', 'Produkcija (omega)', 5, 1, 'active'),
(6, 'Postprodukcija', 'Postprodukcija', 6, 1, 'active'),
(7, 'Završen', 'FINAL OK – završeno', 7, 1, 'done'),
(8, 'Zatvoren', 'Zatvoren (soft-lock)', 8, 1, 'closed'),
(9, 'Fakturisan', 'Fakturisan (read-only)', 9, 1, 'invoiced'),
(10, 'Arhiviran', 'Arhiviran', 10, 1, 'arch'),
(11, 'Na čekanju', 'Na čekanju', 11, 1, 'arch'),
(12, 'Otkazan', 'Storniran', 12, 1, 'cancelled');
