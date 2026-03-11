# Plan: CSV/XLSX Import u šifarnike (tačka 7)

Šta nam treba da tačka 7 bude gotova.

---

## 1. Šta već postoji

- **API rute** (bez UI u Studiju):
  - `POST /api/import/talenti` – CSV (;), kolone: ime_prezime, vrsta, email, telefon, napomena, aktivan → upis u **stg_talenti** (staging), ne direktno u `talenti`.
  - `POST /api/import/dobavljaci_text` – CSV (;) ili JSON sa csv_b64 → **stg_dobavljaci**.
- **Nema:** UI u Studio za import, XLSX podrška, predlošci za preuzimanje, cjenovnik, klijenti. Nema jedinstvenog toka: upload → preview → potvrda → upis u **pravu** tabelu.

---

## 2. Šta treba uraditi

| # | Stavka | Opis |
|---|--------|------|
| A | **Predlošci (templates)** | Jedan XLSX/CSV po šifarniku sa **tačnim zaglavljem kolona** koje sistem očekuje. Korisnik preuzme, popuni, importuje. |
| B | **Podrška za XLSX** | Čitanje .xlsx u API-ju (npr. biblioteka `xlsx` ili `exceljs`). CSV ostaje podržan. |
| C | **Import direktno u tabelu** | Za svaki šifarnik: jedan API koji prima fajl, parsira redove, validira i upisuje u **pravu** tabelu (cjenovnik_stavke, klijenti, dobavljaci, talenti), ne u staging. Opciono: prvo staging pa "Primijeni" – ali za prvu verziju dovoljno je direktan upis. |
| D | **UI u Studio** | Na stranici svakog šifarnika (ili jedna zajednička "Import"): **Preuzmi predložak** + **Odaberi fajl** + **Pregled (preview)** prvih N redova + **Import** (sa upozorenjem "X redova će biti dodato"). Prikaz grešaka po redu ako neki red pukne. |
| E | **Validacija i greške** | Validacija po redu (obavezna polja, formati). Prikaz koji redovi su OK, koji imaju grešku. Opcija: import samo valjanih redova ili "sve ili ništa". |

---

## 3. Predlošci po šifarniku – kolone u fajlu

Zaglavlje u templateu mora odgovarati ovim nazivima (ili će UI mapirati "naziv iz fajla" → "polje u bazi").

### Cjenovnik (cjenovnik_stavke)

| Kolona u fajlu   | Obavezno | Napomena |
|------------------|----------|----------|
| naziv            | da       | |
| jedinica         | da       | KOM, SAT, MIN, PAKET, DAN, OSTALO |
| cijena_default   | da       | Broj (npr. 10.50) |
| valuta_default   | ne       | KM (BAM) ili EUR, default KM |
| cijena_ino_eur   | ne       | Broj ili prazno |
| active           | ne       | 1/0 ili da/ne, default 1 |

### Klijenti (klijenti)

| Kolona u fajlu   | Obavezno | Napomena |
|------------------|----------|----------|
| naziv_klijenta   | da       | |
| tip_klijenta     | ne       | direktni / agencija, default direktni |
| porezni_id       | ne       | PIB/JIB |
| adresa           | ne       | |
| grad             | ne       | |
| drzava           | ne       | |
| rok_placanja_dana| ne       | Broj, default npr. 30 |
| napomena         | ne       | |
| aktivan          | ne       | 1/0, default 1 |
| is_ino           | ne       | 1/0, default 0 |
| pdv_oslobodjen   | ne       | 1/0, default 0 |
| pdv_oslobodjen_napomena | ne | |

### Dobavljači (dobavljaci)

| Kolona u fajlu   | Obavezno | Napomena |
|------------------|----------|----------|
| naziv            | da       | |
| vrsta            | ne       | studio, freelancer, servis, ostalo |
| pravno_lice      | ne       | 1/0, default 1 |
| drzava_iso2      | ne       | BA, HR, ... |
| grad             | ne       | |
| postanski_broj   | ne       | |
| adresa           | ne       | |
| email            | ne       | |
| telefon          | ne       | |
| napomena         | ne       | |
| aktivan          | ne       | 1/0, default 1 |

### Talenti (talenti)

| Kolona u fajlu   | Obavezno | Napomena |
|------------------|----------|----------|
| ime_prezime      | da       | |
| vrsta            | ne       | spiker, glumac, pjevac, dijete, muzicar, ostalo |
| email            | ne       | |
| telefon          | ne       | |
| napomena         | ne       | |
| aktivan          | ne       | 1/0, default 1 |

---

## 4. Redoslijed implementacije (preporuka)

1. **Predlošci**  
   Kreirati XLSX (ili CSV) fajlove sa jednim redom zaglavlja i jednim primjerom reda. Držati ih u repo npr. `public/templates/import/` (cjenovnik.xlsx, klijenti.xlsx, dobavljaci.xlsx, talenti.xlsx) i u UI dugme "Preuzmi predložak" koje vodi na taj fajl.

2. **API za import (po šifarniku)**  
   - Jedan endpoint po šifarniku npr. `POST /api/studio/import/cjenovnik`, `.../klijenti`, `.../dobavljaci`, `.../talenti`.  
   - Ulaz: multipart fajl (CSV ili XLSX).  
   - Parsiranje (xlsx lib za .xlsx), validacija redova, INSERT u odgovarajuću tabelu (isti redoslijed kolona kao create actions).  
   - Odgovor: `{ ok, imported, errors: [{ row, message }] }`.

3. **UI u Studio**  
   - Na stranici Cjenovnik (Klijenti, Dobavljači, Talenti) dodati sekciju "Import":  
     - link "Preuzmi predložak" (href na `/templates/import/cjenovnik.xlsx` ili sl.),  
     - file input + dugme "Pregled" ili "Uvezi": upload fajla na odgovarajući API, prikaz preview (prvih 10–20 redova) i broja redova koje će biti uvezene, zatim "Potvrdi import" ili odmah import sa prikazom rezultata (koliko uvezeno, eventualne greške po redu).

4. **Opciono kasnije**  
   - Mapiranje kolona (korisnik bira "kolona A u fajlu = naziv_klijenta").  
   - Staging tabela + "Primijeni" ako želite dvokorak (pregled pa commit).  
   - Rollback (npr. "poništi zadnji import") – složenije, može kasnije.

---

## 5. Tehnički detalji

- **XLSX u Node-u:** paket `xlsx` (SheetJS) ili `exceljs` – čitanje sheet-a, prvi red = zaglavlje, ostali = podaci.
- **Encoding:** CSV UTF-8, eventualno BOM za Excel. XLSX nema problem encodinga.
- **Separator CSV:** trenutno u postojećim API-jevima `;` – u predlošcima i novom importu možemo prihvatiti i `,` (detekcija po prvom redu).
- **created_at / updated_at:** pri INSERT-u staviti `NOW()` kao u postojećim create actions.

Kad odlučiš s kojim šifarnikom krećeš (npr. cjenovnik ili talenti), može se krenuti redom: predložak → API → UI za taj jedan, pa zatim isto za ostale.
