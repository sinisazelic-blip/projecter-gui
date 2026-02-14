-- Oslobođen od PDV-a: klijent može biti oslobođen po Zakonu o PDV-u (član 24)
-- Napomena se prikazuje na fakturi.
-- Pokreni: mysql -u USER -p DATABASE < scripts/fix-klijenti-pdv-oslobodjen.sql

ALTER TABLE klijenti
  ADD COLUMN pdv_oslobodjen TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '1 = oslobođen od PDV-a (član 24, potvrda o oslobađanju)',
  ADD COLUMN pdv_oslobodjen_napomena VARCHAR(500) NULL
  COMMENT 'Napomena za fakturu, npr. broj rješenja i tekst po članu 24';
