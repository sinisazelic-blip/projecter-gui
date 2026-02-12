# Plan: Faze projekta, radnici, deadline, % izvršenosti, Gantt

*Datum: 11.02.2025*

---

## Cilj

Za svaki projekat omogućiti:
- **Faze radnih poslova** (npr. Pre-produkcija, Snimanje, Mixing, Mastering, Isporuka)
- **Deadline po fazi** – ili master deadline projekta ako nema posebnog
- **Zaduženje radnika** – jedan ili više radnika po fazi
- **% izvršenosti** – praćenje napretka
- **Gantt dijagram** – timeline prikaz

---

## 1. Model podataka

### 1.1 Šta već postoji

| Entitet | Opis |
|---------|------|
| **projekti** | rok_glavni (master deadline) |
| **radne_faze** | Šifrarnik tipova faza (naziv, opis_poslova, slozenost_posla, vrsta_posla) |
| **radnici** | Zaposleni |
| **projekat_stavke** | Budžet stavke (iz Deala) – *odvojeno od faza* |

### 1.2 Nove tabele

```
projekat_faze
├── projekat_faza_id (PK)
├── projekat_id (FK → projekti)
├── faza_id (FK → radne_faze)     -- tip faze iz šifarnika
├── naziv (VARCHAR)               -- opciono override (npr. "Mix 1")
├── datum_pocetka (DATE)
├── datum_kraja (DATE)            -- ili izračunato iz deadline
├── deadline (DATE NULL)          -- NULL = koristi projekti.rok_glavni
├── procenat_izvrsenosti (DECIMAL 0-100)
├── redoslijed (INT)              -- za sortiranje
└── napomena (TEXT)

projekat_faza_radnici (N:N)
├── projekat_faza_id (FK)
├── radnik_id (FK)
└── UNIQUE(projekat_faza_id, radnik_id)
```

**Logika deadline-a:**
- Ako `projekat_faze.deadline` ima vrijednost → koristi taj datum
- Ako je NULL → koristi `projekti.rok_glavni` za sve faze tog projekta

**% izvršenosti:** 0–100, ručno ažuriraš ili kasnije automatski (ako uvedeš pod-zadatke).

---

## 2. Korak po korak – korisničko iskustvo

### 2.1 Unos (u Projektu / Detalji)

1. **Link „Faze i timeline”** u stranici projekta
2. **Lista faza** – tabela:
   - Redak = jedna faza
   - Kolone: Tip faze (iz radne_faze), Početak, Kraj, Deadline, % izvršenosti, Radnici (višestruki izbor)
3. **Dugme „Dodaj fazu”** – novi red, izbor tipa faze iz šifarnika
4. **Inline edit** – klik na ćeliju za brzu izmjenu

### 2.2 Prikaz Gantt-a

- **Horizontalna osa:** vrijeme (mjeseci, tjedni ili dani – zoom)
- **Vertikalna osa:** faze (grupe po projektu) ili projekti
- **Bar:** od datum_pocetka do datum_kraja (ili deadline)
- **Overlay:** % izvršenosti kao popunjen dio bara (npr. 60% = 60% bara obojeno)
- **Ikonica radnika** – hover/ tooltip sa imenima

---

## 3. Opcije za Gantt komponentu

| Opcija | Prednosti | Nedostaci |
|--------|-----------|-----------|
| **A) Recharts** (već u projektu) | Nema nove dependencije | Gantt nije native, moraš ga „sastaviti” iz BarChart |
| **B) frappe-gantt** | Jednostavan, lightweight, Gantt-specific | Nova dependencija |
| **C) dhtmlx-gantt** | Pun feature set | Težak, komercijalni za neke stvari |
| **D) Čist CSS + div** | Full control, nema dependencija | Više ručnog rada za zoom, drag |

**Preporuka za početak:** **B) frappe-gantt** – malen, besplatan, dovoljno za timeline + % + radnici u labelu.

---

## 4. Faze implementacije

### Faza A – Model i CRUD (bez Gantta)
1. SQL skripta za `projekat_faze` i `projekat_faza_radnici`
2. API: GET/POST/PATCH faze za projekat
3. Stranica u projektu: „Faze” – tabela za unos i izmjenu

### Faza B – Gantt prikaz
**Kad korisnik ubaci nekoliko faza i testira Fazu A:**
1. Instalacija frappe-gantt (ili alternativa)
2. API ili transform postojećih podataka u format za Gantt
3. View „Timeline” – Gantt dijagram (po projektu ili multi-projekat)

### Faza C – Usavršavanje
1. Zoom (dan / tjedan / mjesec)
2. Drag & drop za mijenjanje datuma (opciono)
3. Filter: samo aktivni projekti, samo određeni radnici

---

## 5. Primjer podataka za Gantt (frappe-gantt format)

```json
[
  {
    "id": "faz-1",
    "name": "Pre-produkcija",
    "start": "2025-02-01",
    "end": "2025-02-15",
    "progress": 80,
    "custom_class": "no-milestone"
  },
  {
    "id": "faz-2",
    "name": "Snimanje",
    "start": "2025-02-16",
    "end": "2025-03-10",
    "progress": 20,
    "dependencies": "faz-1"
  }
]
```

`progress` = % izvršenosti. `dependencies` = opciono, ako želiš da faza 2 počinje tek kad je 1 gotova.

---

## 6. Odluke (odgovori korisnika)

1. **Zavisnosti** – NE formalno. Bez zaposlenika za praćenje. Faze se prikazuju paralelno (jednostavno). % = 0 dok „ne dođe vrijeme” za tu fazu.
2. **Deadline po fazi** – DA. Npr. snimanje instrumenata = 5 dana prije mixa, vokali = 2 dana prije mixa, master = master deadline projekta. Korisnik ručno postavlja datum.
3. **Nivo detalja** – faze samo, bez pod-zadataka.

---

## 7. Sažetak

| Šta | Kako |
|-----|------|
| **Faze** | projekat_faze (veza na radne_faze) |
| **Deadline** | deadline ili rok_glavni |
| **Radnici** | projekat_faza_radnici (N:N) |
| **%** | procenat_izvrsenosti (0–100) |
| **Unos** | Tabela u Projektu → Faze |
| **Prikaz** | Gantt (npr. frappe-gantt) |

---

## 8. Pokretanje (Faza A – implementirano)

1. **Pokreni SQL skriptu:**
   ```bash
   mysql -u USER -p DATABASE < scripts/create-projekat-faze.sql
   ```

2. **Putanja:** Projekat → dugme „Faze” → `/projects/[id]/faze`

3. **Faza B – Gantt:** Kad korisnik ubaci nekoliko faza i testira Fazu A, uvesti Gantt prikaz (frappe-gantt ili slično) – timeline sa barovima po fazama.
