-- Dodaj kolonu datum_rodjenja u radnici ako ne postoji
-- Pokreni: mysql -u USER -p DATABASE < scripts/add-radnici-datum-rodjenja.sql
-- Napomena: Ako kolona već postoji, ignoriraj grešku "Duplicate column"

ALTER TABLE radnici ADD COLUMN datum_rodjenja DATE NULL AFTER email;
