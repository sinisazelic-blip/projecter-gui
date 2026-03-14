-- Poveži korisnika (users) sa radnikom (radnici) za Account Manager
-- Pokreni: mysql -u USER -p DATABASE < scripts-RedDellvill/fix-user-radnik-link.sql
--
-- 1. Provjeri trenutno stanje (korisnici bez radnik_id):
--    SELECT user_id, username, radnik_id FROM users WHERE radnik_id IS NULL;
--
-- 2. Pronađi radnik_id za Sinišu Zelića:
--    SELECT radnik_id, ime, prezime FROM radnici WHERE ime LIKE '%Siniša%' AND prezime LIKE '%Zelić%';
--
-- 3. Ažuriraj (zamijeni USERNAME i RADNIK_ID):
--    UPDATE users SET radnik_id = RADNIK_ID WHERE username = 'USERNAME' AND radnik_id IS NULL;
--
-- Primjer za Sinišu (prilagodi username ako je drugačiji):
-- UPDATE users SET radnik_id = (SELECT radnik_id FROM radnici WHERE ime = 'Siniša' AND prezime = 'Zelić' LIMIT 1) WHERE username = 'sinisa' AND radnik_id IS NULL;

-- Provjera: korisnici bez radnik_id
SELECT 'Korisnici bez radnik_id:' AS info;
SELECT user_id, username, radnik_id FROM users WHERE radnik_id IS NULL;

-- Provjera: radnici Siniša Zelić
SELECT 'Radnici (Siniša Zelić):' AS info;
SELECT radnik_id, ime, prezime FROM radnici WHERE (ime LIKE '%Siniša%' OR ime LIKE '%Sinisa%') AND (prezime LIKE '%Zelić%' OR prezime LIKE '%Zelic%');

-- 4. AŽURIRANJE (ručno - zamijeni X i Y):
--    UPDATE users SET radnik_id = X WHERE user_id = Y;
--    X = radnik_id iz radnici tabele
--    Y = user_id iz users tabele
