# proJECTer – API Contracts (GUI <-> Backend)

## Konvencije
- Base URL: `/api`
- Response format:
  - success: `{ ok: true, data: ... }`
  - error: `{ ok: false, error: "..." }`
- Valuta u GUI: **KM** (backend može čuvati BAM/EUR/USD, ali `*_km` polja su canonical za analitiku)

## Auth (faza 1)
- Za start: bez autentikacije ili “admin token” u env var.
- Faza 2: login (session/JWT) + role.

---

## Projekti

### GET /api/projekti
Query:
- `page` (default 1)
- `pageSize` (default 50)
- `godina` (optional)
- `klijent_id` (optional)
- `q` (search naziv)

Response:
- `{ ok:true, data:{ items:[{ projekat_id, naziv_projekta, created_at, klijent:{klijent_id,naziv_klijenta}, status }], page, pageSize, total } }`

### GET /api/projekti/:id
Response:
- `{ ok:true, data:{ projekat, troskovi, fakture, uplate } }`

---

## Klijenti

### GET /api/klijenti
Query:
- `q`
- `tip` (direktni|agencija|all)

Response:
- `{ ok:true, data:{ items:[{klijent_id,naziv_klijenta,tip,...}] } }`

### GET /api/klijenti/:id
Response:
- `{ ok:true, data:{ klijent, pocetno_stanje, projekti_summary, fakture_summary } }`

---

## Projektni troškovi (varijabilni)

### GET /api/projekti/:id/troskovi
Response:
- `{ ok:true, data:[{trosak_id, tip, datum_nastanka, iznos, valuta, kurs_u_km, iznos_km, status, talent?, dobavljac?}] }`

### POST /api/projekti/:id/troskovi  (faza 2)
Body:
- `{ tip_id, datum_nastanka, iznos, valuta, talent_id?, dobavljac_id?, napomena }`

---

## Plaćanja (pokriće troškova)

### GET /api/placanja
Query:
- `from`, `to`
- `q`

### POST /api/placanja  (faza 2)
Body:
- `{ datum_placanja, nacin, iznos_km, stavke:[{trosak_id, iznos_km}] }`

---

## Fiksni troškovi

### GET /api/fiksni-troskovi
Query:
- `status` (CEKA|KASNI|PLACENO|all)
- `days` (default 30)

Response:
- `{ ok:true, data:[{trosak_id,naziv_troska,frekvencija,datum_dospijeca,rok_tolerancije_dana,iznos,valuta,status}] }`

### POST /api/fiksni-troskovi/:id/oznaci-placeno (faza 2)
Body:
- `{ datum: 'YYYY-MM-DD' }`

---

## Fakture + Fiskalno

### GET /api/fakture
Query:
- `godina`
- `klijent_id`
- `tip`

### POST /api/fakture (faza 2)
Body (minimal):
- `{ bill_to_klijent_id, datum_izdavanja, tip, valuta, stavke:[...] }`
Server:
- dodjeljuje broj_u_godini automatski
- dodjeljuje fiskalni broj automatski (uz storno logiku)

### POST /api/fakture/:id/fiskalni/storno (faza 2)
Body:
- `{ razlog }`
Server:
- upisuje fiskalni_dogadjaj tip STORNO
- rezerviše “sljedeći” fiskalni broj za kopiju fakture

---

## Kursna lista

### GET /api/kurs
Query:
- `valuta` (EUR|USD)
- `datum` (YYYY-MM-DD)

Response:
- `{ ok:true, data:{ valuta, datum, kurs_u_km } }`
Napomena:
- EUR: fiksno 1 EUR = 1.95583 KM
- USD: iz kursne liste (upisuje se)
