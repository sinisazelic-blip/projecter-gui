-- Evidencija uplata/izmirenja za početna stanja (31.12.)
-- Omogućava formalno zatvaranje početnih stanja kroz Fluxa-u.
--
-- tip:
-- - 'klijent'   => zatvaranje potraživanja od klijenta (uplata/priliv)
-- - 'dobavljac' => zatvaranje dugovanja prema dobavljaču (isplata/odliv)
-- - 'talent'    => zatvaranje dugovanja prema talentu (isplata/odliv)
--
-- amount_km je uvijek pozitivan broj (apsolutna vrijednost).

CREATE TABLE IF NOT EXISTS pocetno_stanje_uplate (
  uplata_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tip ENUM('klijent','dobavljac','talent') NOT NULL,
  ref_id INT NOT NULL,
  posting_id BIGINT NULL,
  datum DATE NOT NULL,
  amount_km DECIMAL(12,2) NOT NULL DEFAULT 0,
  napomena VARCHAR(255) NULL,
  aktivan TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (uplata_id),
  KEY idx_tip_ref (tip, ref_id),
  KEY idx_posting (posting_id),
  KEY idx_datum (datum)
);

