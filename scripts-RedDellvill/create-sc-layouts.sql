-- StrategicCore: Layout šabloni (šahovska tabla)
-- Pokreni jednom: mysql -u user -p studio_db < create-sc-layouts.sql

CREATE TABLE IF NOT EXISTS sc_layouts (
  sc_layout_id INT AUTO_INCREMENT PRIMARY KEY,
  naziv VARCHAR(120) NOT NULL,
  cols INT NOT NULL DEFAULT 4,
  `rows` INT NOT NULL DEFAULT 6,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_naziv (naziv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sc_layout_cells (
  sc_layout_cell_id INT AUTO_INCREMENT PRIMARY KEY,
  sc_layout_id INT NOT NULL,
  col_index INT NOT NULL,
  row_index INT NOT NULL,
  stavka_id INT NOT NULL,
  boja VARCHAR(20) NOT NULL DEFAULT '#7dd3fc',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_layout_pos (sc_layout_id, col_index, row_index),
  FOREIGN KEY (sc_layout_id) REFERENCES sc_layouts(sc_layout_id) ON DELETE CASCADE,
  FOREIGN KEY (stavka_id) REFERENCES cjenovnik_stavke(stavka_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
