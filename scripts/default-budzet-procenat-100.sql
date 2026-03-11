-- Default budzet_procenat_za_tim na 100% (umjesto 50%)
-- Pokreni jednom na bazi kada želiš da svi projekti imaju podrazumijevano 100%.

-- 1) Postojeći projekti: postavi 50 ili NULL na 100
UPDATE projekti
SET budzet_procenat_za_tim = 100.00
WHERE budzet_procenat_za_tim IS NULL OR budzet_procenat_za_tim = 50.00;

-- 2) Promjena DEFAULT-a za nove projekte (MySQL)
ALTER TABLE projekti
MODIFY COLUMN budzet_procenat_za_tim DECIMAL(5,2) DEFAULT 100.00;
