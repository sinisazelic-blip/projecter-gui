-- Ispravi brojac_faktura — DO ima zadnji_broj, API očekuje zadnji_broj_u_godini
-- Pokreni: mysql -u USER -p -h DO_HOST DATABASE < scripts/fix-brojac-faktura-kolona.sql
-- PRVO: SHOW COLUMNS FROM brojac_faktura; — ako vidiš zadnji_broj, pokreni ovo:

ALTER TABLE brojac_faktura
  CHANGE COLUMN zadnji_broj zadnji_broj_u_godini INT NOT NULL DEFAULT 0;
