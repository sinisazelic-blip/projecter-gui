# Početna stanja (31.12.2025) – gdje su u bazi

Tabele sa početnim stanjima u bazi **studio_db** (provjereno).

---

## 1. Tabele početnih stanja (tačni nazivi)

| Entitet   | Tabela                      | Napomena |
|-----------|-----------------------------|----------|
| Klijenti  | **klijent_pocetno_stanje**  | Početna stanja po klijentu (njihovo dugovanje prema tebi – opciono koristiti dok traju sudski sporovi). |
| Dobavljači| **dobavljac_pocetno_stanje**| Tvoja dugovanja prema dobavljačima (početno stanje 31.12.2025). |
| Talenti   | **talent_pocetno_stanje**   | Tvoja dugovanja prema talentima (iznos_duga_km po talentu). |

**Upiti za pregled:**
```sql
SELECT * FROM studio_db.klijent_pocetno_stanje;
SELECT * FROM studio_db.dobavljac_pocetno_stanje;
SELECT * FROM studio_db.talent_pocetno_stanje;
```

---

## 2. Šta kaže dokumentacija (DB_MAP.md) – referenca

### Klijenti
- **klijent_pocetno_stanje** (u DB_MAP ranije navedeno kao klijenti_pocetno_stanje – ispravan naziv tabele je singular).

### Talenti
- **talent_pocetno_stanje** – FK: talent_id → talenti.talent_id, iznos_duga_km, napomena.

### Dobavljači
- **dobavljac_pocetno_stanje** – tvoja dugovanja prema dobavljačima (početno stanje). U DB_MAP je navedena samo dobavljac_istorija; tabela početnog stanja postoji pod ovim nazivom.

---

## 2. Operativna tabela: tvoja dugovanja (prema dobavljačima i talentima)

**projekt_dugovanja** – ovdje se vode **obaveze prema dobavljačima i talentima** (po projektu ili „van projekta”):

- `dugovanje_id`, `projekat_id` (može NULL)
- **dobavljac_id** → dobavljaci.dobavljac_id  
- **talent_id** → talenti.talent_id  
- `datum`, `datum_dospijeca`, `iznos_km`, `opis`, `status` (CEKA/PLACENO/DJELIMICNO/STORNO), itd.

Plaćanja prema tim dugovanjima: **projekt_dugovanje_placanje_link** + view **v_dugovanja_paid_sum**.

Početna stanja su u posebnim tabelama: **dobavljac_pocetno_stanje**, **talent_pocetno_stanje**. Tekuća dugovanja (nova, plaćanja) vode se u **projekt_dugovanja**.

---

## 4. Rezime

| Šta tražiš | Tabela u bazi |
|------------|----------------|
| Početna stanja **klijenata** (njihovo dugovanje prema tebi) | **klijent_pocetno_stanje** |
| Tvoja dugovanja prema **dobavljačima** (početno) | **dobavljac_pocetno_stanje** |
| Tvoja dugovanja prema **talentima** (početno) | **talent_pocetno_stanje** |

Operativna tabela za tekuća dugovanja (unos novih, plaćanja): **projekt_dugovanja** + **projekt_dugovanje_placanje_link** + view **v_dugovanja_paid_sum**.

---

## 5. Evidencija u aplikaciji

- **Stranica:** Finansije → **Početna stanja** (`/finance/pocetna-stanja`). Tri sekcije: Klijenti (potraživanja), Dobavljači (naša dugovanja), Talenti (naša dugovanja). Za svaku: tabela sa nazivom, iznos KM, napomena + ukupno.
- **API:** `GET /api/pocetna-stanja` vraća `{ ok, klijenti, dobavljaci, talenti }`.
- **Kolone u bazi (provjereno):**  
  - **klijent_pocetno_stanje:** `klijent_id`, **iznos_potrazuje**, `status_potraživanja`, `napomena`, `datum_stanja`.  
  - **dobavljac_pocetno_stanje:** `dobavljac_id`, **iznos_duga**, `napomena`, `datum_stanja`.  
  - **talent_pocetno_stanje:** `talent_id`, **iznos_duga**, `napomena`, `datum_stanja`.

---

## 6. XLSX import

Na stranici **Evidencija početnih stanja** (`/finance/pocetna-stanja`) dostupan je **Import iz XLSX**:

- **Preuzmi predložak** – XLSX sa 3 lista: **Klijenti**, **Dobavljači**, **Talenti**.
- **Kolone po listu:**
  - **Klijenti:** `naziv_klijenta` (tačno kao u šifarniku Studio → Klijenti), `iznos_potrazuje`, `napomena`.
  - **Dobavljači:** `naziv` (tačno kao u šifarniku Studio → Dobavljači), `iznos_duga`, `napomena`.
  - **Talenti:** `ime_prezime` (tačno kao u šifarniku Studio → Talenti), `iznos_duga`, `napomena`.
- Naziv mora odgovarati postojećem zapisu u šifarniku (inace red se preskače s greškom). Uvoz upisuje u tabele `klijent_pocetno_stanje`, `dobavljac_pocetno_stanje`, `talent_pocetno_stanje` (INSERT ili ON DUPLICATE KEY UPDATE ako već postoji red za tog klijenta/dobavljača/talenta).

---

## 7. Otpis duga (početna stanja)

Za označavanje nenaplativih potraživanja od klijenata i storno dugovanja prema dobavljačima/talentima (firma ugašena, storno ranijih godina) dodane su kolone u sve tri tabele početnih stanja (v. tačka 11 u PLAN.md):

- **otpisano** (TINYINT(1) DEFAULT 0)
- **otpis_razlog** (VARCHAR(500) NULL)
- **otpis_datum** (DATE NULL)

**Migracija:** Pokrenuti jednom skriptu `scripts-RedDellvill/otpis-duga-kolone.sql`.

Na stranici **Evidencija početnih stanja** svaka stavka iz tabele (ne „Tekuće dugovanje” iz projekt_dugovanja) ima dugme **Otpisi**; unosi se opcioni razlog. Ukupna suma na stranici i u blokovima „Početna stanja” na drugim stranicama računaju samo **aktivna** stanja (otpisano = 0).
