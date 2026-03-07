-- Uloge iz docs/Fluxa prava pristupa i users.xlsx (sheet Roles)
-- Pokreni: mysql -u USER -p DATABASE < scripts/seed-roles-from-excel.sql
-- Ako već imaš uloge, prilagodi (npr. samo UPDATE nivo_ovlastenja po naziv).

-- Napomena: Kolona može biti nivo_ovlastenja ili nivo_ovlascenja – prilagodi naziv ispod.
INSERT INTO roles (naziv, nivo_ovlastenja, opis) VALUES
  ('Guest', 1, 'Demo / samo pregled'),
  ('Racunovodstvo', 2, 'Računovodstvo'),
  ('User', 3, 'Korisnik'),
  ('Account', 5, 'Account'),
  ('Producer', 6, 'Producent'),
  ('SuperUser', 8, 'Super korisnik'),
  ('Administrator', 9, 'Administrator'),
  ('Owner', 10, 'Vlasnik')
ON DUPLICATE KEY UPDATE nivo_ovlastenja = VALUES(nivo_ovlastenja), opis = VALUES(opis);

-- Ako nemaš UNIQUE na naziv: umjesto gornjeg ručno dodaj ili ažuriraj po role_id.
