-- Uloga Saradnik (nivo 0) – samo projekti u kojima je dodijeljen u radnim fazama
-- Pokreni: mysql -u USER -p DATABASE < scripts/add-role-saradnik.sql
-- Tvoja baza koristi kolonu nivo_ovlascenja (bez 't').

INSERT INTO roles (naziv, nivo_ovlascenja, opis) VALUES
  ('Saradnik', 0, 'Vanjski saradnik – vidi samo projekte u kojima učestvuje (radne faze), može dodavati troškove, faze read-only')
ON DUPLICATE KEY UPDATE nivo_ovlascenja = 0, opis = VALUES(opis);
