-- Ponuda / predračun – korak između Deal i Projekat. Snapshot stavki Deal-a, broj P001/YYYY.
-- Pokreni u bazi prije korištenja Ponude iz Deal stranice.

CREATE TABLE IF NOT EXISTS ponude (
  ponuda_id INT AUTO_INCREMENT PRIMARY KEY,
  inicijacija_id INT NOT NULL COMMENT 'Deal iz kojeg je kreirana',
  godina INT NOT NULL COMMENT 'Godina za broj P001/YYYY',
  broj_u_godini INT NOT NULL COMMENT 'Redni broj u godini (1, 2, ...)',
  datum_izdavanja DATE NOT NULL,
  datum_vazenja DATE NOT NULL COMMENT 'Ponuda vrijedi do',
  klijent_id INT NOT NULL COMMENT 'Naručilac (iz deal-a)',
  valuta VARCHAR(10) NOT NULL DEFAULT 'KM' COMMENT 'KM ili EUR po klijentu',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ponude_inicijacija (inicijacija_id),
  INDEX idx_ponude_godina_broj (godina, broj_u_godini),
  CONSTRAINT fk_ponude_inicijacija FOREIGN KEY (inicijacija_id) REFERENCES inicijacije(inicijacija_id) ON DELETE CASCADE,
  CONSTRAINT fk_ponude_klijent FOREIGN KEY (klijent_id) REFERENCES klijenti(klijent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Ponude (predračuni) – snapshot Deal stavki, broj P001/YYYY.';

CREATE TABLE IF NOT EXISTS ponuda_stavke (
  ponuda_stavka_id INT AUTO_INCREMENT PRIMARY KEY,
  ponuda_id INT NOT NULL,
  naziv_snapshot VARCHAR(500) NOT NULL,
  jedinica_snapshot VARCHAR(50) NULL DEFAULT 'kom',
  kolicina DECIMAL(12, 4) NOT NULL DEFAULT 1,
  cijena_jedinicna DECIMAL(12, 2) NOT NULL,
  valuta VARCHAR(10) NOT NULL DEFAULT 'KM',
  opis VARCHAR(500) NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  CONSTRAINT fk_ponuda_stavke_ponuda FOREIGN KEY (ponuda_id) REFERENCES ponude(ponuda_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stavke ponude – kopija stavki Deal-a u trenutku izdavanja.';
