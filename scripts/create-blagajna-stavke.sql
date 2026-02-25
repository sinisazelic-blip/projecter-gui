-- Pokreni ovaj skript u bazi prije korištenja stranice Blagajna (cash).
-- Tabela za blagajnu (cash). Ništa se ne briše – uklonjene stavke se storniraju (status = 'STORNIRAN').
-- Jedna istorija, pretraga po datumu i po entitetu (talent, dobavljač, projekat).

CREATE TABLE IF NOT EXISTS blagajna_stavke (
  id INT AUTO_INCREMENT PRIMARY KEY,
  datum DATE NOT NULL COMMENT 'Datum transakcije',
  iznos DECIMAL(12, 2) NOT NULL,
  valuta VARCHAR(10) NOT NULL DEFAULT 'KM',
  smjer ENUM('IN', 'OUT') NOT NULL,
  napomena VARCHAR(500) NOT NULL,
  project_id INT NULL,
  entity_type VARCHAR(20) NULL COMMENT 'talent | vendor | klijent',
  entity_id INT NULL COMMENT 'talent_id / dobavljac_id / klijent_id',
  transaction_details VARCHAR(500) NULL COMMENT 'npr. Projekat #123 arhiviran, Talent: Ime - Plaćeno...',
  status VARCHAR(20) NOT NULL DEFAULT 'AKTIVAN' COMMENT 'AKTIVAN | STORNIRAN',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_blagajna_datum (datum),
  INDEX idx_blagajna_status (status),
  INDEX idx_blagajna_entity (entity_type, entity_id),
  INDEX idx_blagajna_project (project_id),
  INDEX idx_blagajna_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Blagajna – uplate/isplate. Soft delete: storno, ne brisanje.';
