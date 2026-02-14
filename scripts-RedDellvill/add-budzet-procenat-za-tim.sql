-- Dodavanje kolone budzet_procenat_za_tim u projekti tabelu
-- Default vrednost: 50.00 (50%)
-- Owner može postaviti procenat budžeta koji će biti vidljiv radnicima

ALTER TABLE projekti
ADD COLUMN budzet_procenat_za_tim DECIMAL(5,2) DEFAULT 50.00
COMMENT 'Procenat budžeta vidljiv radnicima (default 50%)';
