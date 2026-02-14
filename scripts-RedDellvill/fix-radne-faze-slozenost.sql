-- Fix: slozenost_posla mora biti VARCHAR da prihvati tekst (npr. "Složen", "Jednostavno")
-- Greška: Incorrect integer value: 'Složen' for column 'slozenost_posla'
-- Pokreni: mysql -u USER -p DATABASE < scripts/fix-radne-faze-slozenost.sql

ALTER TABLE radne_faze
  MODIFY COLUMN slozenost_posla VARCHAR(100) NULL;
