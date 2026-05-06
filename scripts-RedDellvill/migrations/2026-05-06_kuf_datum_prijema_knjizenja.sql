-- Add receipt/booking date for KUF entries (datum_prijema).
-- Purpose: PDV ulazni should follow the month invoice physically arrived / was booked.
-- Safe / idempotent for older MySQL versions (no ADD COLUMN IF NOT EXISTS).

SET @db := DATABASE();

-- datum_prijema (DATE)
SET @has_datum_prijema := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db AND table_name = 'kuf_ulazne_fakture' AND column_name = 'datum_prijema'
);
SET @sql_add_datum_prijema := IF(
  @has_datum_prijema = 0,
  'ALTER TABLE kuf_ulazne_fakture ADD COLUMN datum_prijema DATE NULL AFTER datum_dospijeca',
  'SELECT 1'
);
PREPARE stmt1 FROM @sql_add_datum_prijema; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

-- backfill: default booking date = invoice date for existing rows (cannot infer actual receipt date)
SET @sql_backfill := IF(
  @has_datum_prijema = 0,
  'UPDATE kuf_ulazne_fakture SET datum_prijema = datum_fakture WHERE datum_prijema IS NULL',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql_backfill; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- index for period filtering
SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = @db AND table_name = 'kuf_ulazne_fakture' AND index_name = 'idx_kuf_datum_prijema'
);
SET @sql_add_idx := IF(
  @has_idx = 0,
  'ALTER TABLE kuf_ulazne_fakture ADD KEY idx_kuf_datum_prijema (datum_prijema)',
  'SELECT 1'
);
PREPARE stmt3 FROM @sql_add_idx; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

