-- Rješava "Data truncated for column 'vrsta' at row 1" u tabeli talenti.
-- Kolona vrsta mora prihvatiti sve vrste iz Studio UI (npr. vidograf, developer, snimatelj).
--
-- OPCIJA A – VARCHAR (preporučeno): nema više problema s novim vrstama
ALTER TABLE talenti
  MODIFY COLUMN vrsta VARCHAR(30) NULL DEFAULT 'ostalo';

-- OPCIJA B – ako želiš ostati na ENUM, zakomentiraj gornji ALTER i odkomentiraj ovaj:
/*
ALTER TABLE talenti
  MODIFY COLUMN vrsta ENUM(
    'account',
    'copywriter',
    'developer',
    'dijete',
    'glumac',
    'kompozitor',
    'montazer',
    'muzicar',
    'organizator',
    'ostalo',
    'pjevac',
    'producent',
    'reziser',
    'snimatelj',
    'spiker',
    'vidograf'
  ) NULL DEFAULT 'ostalo';
*/
