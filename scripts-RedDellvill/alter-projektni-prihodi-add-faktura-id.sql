-- Povezivanje prihoda (izvod) s fakturom: kolona faktura_id u projektni_prihodi.
-- Kad se prihod kreira pri ručnom knjiženju izvoda i veže na fakturu,
-- faktura se može označiti kao naplaćena (fiskalni_status = PLACENA).
-- Jedna zbirna mjesečna faktura (npr. 25 projekata) = jedan prihod s faktura_id;
-- projekat_id se postavlja na prvi projekat s te fakture (za knjige po projektu).

-- Ako kolona već postoji, preskoči ovaj ALTER (ili pokreni samo drugi).
ALTER TABLE projektni_prihodi
  ADD COLUMN faktura_id INT UNSIGNED NULL DEFAULT NULL AFTER projekat_id;

ALTER TABLE projektni_prihodi
  ADD INDEX idx_projektni_prihodi_faktura (faktura_id);
