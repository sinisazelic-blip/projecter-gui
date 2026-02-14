-- ProBono projekti: nikad se ne fakturišu ni naplaćuju
-- Svaka ozbiljna firma ima razloge da radi nešto bez finansijske koristi.
-- Pokreni: mysql -u USER -p DATABASE < scripts/fix-projekti-pro-bono.sql

ALTER TABLE projekti
  ADD COLUMN pro_bono TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '1 = ProBono, nikad se ne fakturiše';
