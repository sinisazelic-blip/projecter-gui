-- Dozvoli vrijednosti PLACENA i DJELIMICNO u fiskalni_status (oznaka naplate).
-- "Data truncated for column 'fiskalni_status'" = kolona je ENUM ili preuski VARCHAR bez tih vrijednosti.

-- Opcija A: Ako je kolona ENUM, proširi je (zamijeni listu s onom koja uključuje PLACENA/DJELIMICNO).
-- Prvo provjeri: SHOW COLUMNS FROM fakture LIKE 'fiskalni_status';
-- Ako je npr. ENUM('DODIJELJEN','POSLAN'), pokreni:

-- ALTER TABLE fakture
--   MODIFY COLUMN fiskalni_status ENUM(
--     'DODIJELJEN','POSLAN','PLACENA','DJELIMICNO','STORNIRAN','ZAMIJENJEN'
--   ) NULL DEFAULT NULL;

-- Opcija B (preporučeno): Pretvori u VARCHAR da sve vrijednosti rade bez budućih ALTER-a:
ALTER TABLE fakture
  MODIFY COLUMN fiskalni_status VARCHAR(30) NULL DEFAULT NULL
  COMMENT 'DODIJELJEN, POSLAN, PLACENA, DJELIMICNO, STORNIRAN, ZAMIJENJEN';
