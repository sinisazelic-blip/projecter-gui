-- Jedan izvod (isti fajl) = jedan batch. Dodaj UNIQUE na file_hash da se duplikat ne može unijeti.
-- Ako već imaš duplikate (isti file_hash više puta), prvo ih očisti (ostavi jedan batch_id po file_hash), pa pokreni ovu skriptu.
--
-- Provjera duplikata (pokreni prvo):
-- SELECT file_hash, COUNT(*) AS cnt FROM bank_import_batch GROUP BY file_hash HAVING cnt > 1;
--
-- Pokretanje:
-- mysql -u user -p studio_db < scripts/alter-bank-import-batch-unique-file-hash.sql

ALTER TABLE bank_import_batch
  ADD UNIQUE KEY uk_bank_import_batch_file_hash (file_hash);
