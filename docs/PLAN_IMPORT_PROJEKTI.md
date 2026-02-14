# Plan: Uvoz projekata iz XLSX (bulk)

Da li možemo ponovo uvesti 5700 projekata (ili bilo koji broj) iz Excel-a? **Da.**

Isti princip kao za šifarnike: predložak XLSX → popuniš / dovučeš podatke → jedan klik „Uvezi” → API parsira, validira i upisuje u `projekti`.

---

## Šta treba u bazi (već postoji)

Tabela **projekti** (relevantne kolone za minimalan red):

| Kolona            | Obavezno | Napomena |
|-------------------|----------|----------|
| projekat_id       | auto     | AUTO_INCREMENT (ili MAX+1 u kodu) |
| id_po             | da       | Obično = projekat_id (sifra projekta) |
| status_id         | da       | 1 = u pregovorima, 3 = aktivan, 7 = završen, itd. |
| radni_naziv       | da       | Naziv projekta |
| narucilac_id      | da       | FK → klijenti.klijent_id (naručilac) |
| krajnji_klijent_id| ne       | FK → klijenti.klijent_id (krajnji klijent) |
| tip_roka          | ne       | npr. 'deadline' (default) |
| rok_glavni        | ne       | DATETIME/DATE – glavni rok |
| napomena          | ne       | Tekst |

U kodu se već koristi i: `naziv_za_fakturu`, `operativni_signal`, `budzet_procenat_za_tim`, `pro_bono` – to možemo dodati u predložak kasnije ako zatreba.

---

## Predložak XLSX (kolone u fajlu)

Minimalno za brzi uvoz:

| Kolona u fajlu   | Obavezno | Napomena |
|------------------|----------|----------|
| radni_naziv      | da       | Naziv projekta |
| narucilac_id     | da*      | ID klijenta (naručilac) – broj |
| narucilac_naziv  | alt      | Ako nemaš ID: naziv klijenta, sistem traži prvi match po nazivu |
| krajnji_klijent_id | ne     | ID krajnjeg klijenta ili prazno |
| status_id        | ne       | 1–7 (default 3 = aktivan) |
| rok_glavni       | ne       | 2025-12-31 ili 31.12.2025 (parsirat ćemo) |
| napomena         | ne       | Tekst |

\* Ili **narucilac_naziv** – onda u API-ju radimo lookup: `SELECT klijent_id FROM klijenti WHERE naziv_klijenta = ? LIMIT 1`. Ako imaš samo Excel sa nazivima klijenata, ne moraš ručno tražiti ID-eve.

Opciono kasnije: `naziv_za_fakturu`, `id_po` (ako želiš da zadržavaš stare sifre).

---

## Redoslijed implementacije

1. **Predložak**  
   Kreirati `public/templates/import/projekti.xlsx` sa jednim redom zaglavlja i jednim primjerom reda (kao u UPUTSTVO-PREDLOZCI-IMPORT.md).

2. **API**  
   - `POST /api/studio/import/projekti`  
   - Ulaz: multipart fajl (XLSX).  
   - Parsiranje: isto kao za šifarnike (`parseXlsxToRows`).  
   - Za svaki red:  
     - Ako imaš `narucilac_id` (broj) – koristi ga; ako imaš `narucilac_naziv` – nađi `klijent_id` po nazivu.  
     - Rok: parsiranje datuma (YYYY-MM-DD ili DD.MM.YYYY).  
     - INSERT u `projekti`: koristiti postojeći pattern (npr. kao u `inicijacije/convert`: bez projekat_id ako je AUTO_INCREMENT, pa nakon INSERT-a ažurirati `id_po = projekat_id` ako treba; ili MAX+1 kao u `otvori-projekat`).  
   - Odgovor: `{ ok, imported, total, errors: [{ row, message }] }`.

3. **UI**  
   - Na stranici gdje ima smisla (npr. **Projekti** lista ili posebna „Import projekata” u Studiju):  
     - Link „Preuzmi predložak” → `/templates/import/projekti.xlsx`  
     - File input (XLSX) + dugme „Uvezi”  
     - Prikaz: „Uvezeno N od M”, greške po redu.

4. **Veliki uvoz (5700 redova)**  
   - Raditi u **batch-evima** (npr. 200–500 redova po zahtjevu) da ne timeouta request i da se greške lakše prikažu.  
   - Ili: jedan veliki fajl, API obrađuje red po red u petlji i vraća rezultat na kraju (može trajati 1–2 min za 5700 redova – onda povećati timeout na serveru).

---

## Šta ti treba od mene

1. Imaš li **postojeći Excel** iz kog si ranije importovao tih 5700 projekata? Ako da – kolone koje tamo imaš (nazivi) napiši ovdje, da predložak i API prilagodimo tome (bez potrebe da sve ručno preimenuješ).  
2. Naručilac u tom Excel-u: **ID klijenta** ili **naziv klijenta**?  
3. Želiš li da uvoz bude na stranici **Projekti** (lista) ili u **Studio** (npr. novi podmeni „Import projekata”)?

Kad odgovoriš na to, mogu predložiti tačan redoslijed kolona u predlošku i nastaviti s implementacijom (predložak → API → UI, pa opciono batch za veliki broj redova).
