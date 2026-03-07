-- Opcioni YID (identifikator uređaja) za header u zahtjevima prema fiskalnom uređaju.
-- Npr. YIDLLocalHardvare iz JP Aquana configa; ako uređaj očekuje, šalje se u headeru.

ALTER TABLE firma_fiskal_settings
  ADD COLUMN yid VARCHAR(64) NULL COMMENT 'YID / device ID za header, opciono'
  AFTER api_key;
