-- Otpis duga (tačka 11): kolone za označavanje otpisa u početnim stanjima.
-- projekt_dugovanja već ima status (STORNO); projekt_potrazivanja koristi status = 'OTPISANO'.
-- Pokreni jednom: mysql -u USER -p DATABASE < scripts-RedDellvill/otpis-duga-kolone.sql

-- 1) Klijent početno stanje (potraživanja od klijenata – nenaplativo)
ALTER TABLE klijent_pocetno_stanje
  ADD COLUMN otpisano TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN otpis_razlog VARCHAR(500) NULL,
  ADD COLUMN otpis_datum DATE NULL;

-- 2) Dobavljač početno stanje (naša dugovanja – storno/otpis)
ALTER TABLE dobavljac_pocetno_stanje
  ADD COLUMN otpisano TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN otpis_razlog VARCHAR(500) NULL,
  ADD COLUMN otpis_datum DATE NULL;

-- 3) Talent početno stanje (naša dugovanja – storno/otpis)
ALTER TABLE talent_pocetno_stanje
  ADD COLUMN otpisano TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN otpis_razlog VARCHAR(500) NULL,
  ADD COLUMN otpis_datum DATE NULL;

-- Napomena: projekt_potrazivanja – ako kolona status ne postoji, dodaj je:
-- ALTER TABLE projekt_potrazivanja ADD COLUMN status VARCHAR(20) NULL DEFAULT NULL;
-- Inače koristi postojeći status sa vrijednošću 'OTPISANO'.
