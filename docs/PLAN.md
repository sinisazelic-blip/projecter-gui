# Plan razvoja – Fluxa / Projecter

*Sačuvano: 11.02.2025*

---

## 1. Izvodi

- Modul za prikaz izvoda **hronološki / po broju**
- Mogućnost odabira i **štampe** ako inspekcija traži izvod

*Detalji za razradu pri implementaciji.*

---

## 2. Detalji projekta – kompleksni prozori

**Lokacija:** Unutar Detalji projekta (kao dugmići)

- **Gantt-like dijagram** – faze, zaposleni, operacije
- Faze i zaposleni koji obavljaju poslove vezane za te faze
- **%** u kojoj se operacija nalazi u fazi
- **Deadline** kad operacija mora biti gotova
- Promjene u otvorenom prozoru mogu se reflektovati na roditeljski prozor

**Status:** Faza A implementirana (projekat_faze, projekat_faza_radnici, CRUD, stranica Faze).  
**Faza B (Gantt):** na redu kad korisnik ubaci nekoliko faza i testira. Detalji: `docs/PLAN_PROJEKT_FAZE_GANTT.md`.

---

## 3. StrategicCore

**Naziv:** StrategicCore – brzo obračunavanje budžeta u pregovorima

**Dizajn:** Mobile-first za Samsung Galaxy S25 / iPhone 16 ProMax. Vertikalni ekran.

**Cilj:** Ekstremne situacije kad je vrijeme reakcije presudno. Sigurnost da je budžet ispravno postavljen može biti presudna. Deal već ima tabelu za sporo određivanje budžeta – SC je puno brži za kompleksne dogovore sa klijentom.

---

### 3.1 Poziv

- **Dashboard** → dugme StrategicCore → otvara popup **Izbor**

---

### 3.2 Popup Izbor (2 dugmeta)

| Dugme | Akcija |
|-------|--------|
| **Novi** | Otvara popup za unos novog Deal-a (isti prozor kao sada za Deal) → klijent i ostalo. Rok i datum se pišu kasnije. **Deal se kreira odmah u bazi** nakon potvrde → **Izaberi layout** |
| **Layout SC** | Kreiranje novog layouta (prazna šahovka) |

---

### 3.3 Novi → Izaberi layout

- Tabela sa **nazivima layout-a** (10–15 max)
- Klik na red → otvara izabrani layout

---

### 3.4 Layout – šahovska tabla (korištenje)

- **Dimenzije:** konfigurabilno (početna: 4 horizontalno × 6 vertikalno). Optimizirano za telefon.
- Svako dugme: unaprijed izabran artikl iz cjenovnika, cijena iz baze
- **Klik na dugme** = +1 komad (zbir se prikazuje)
- **Footer:** zbir + **Prihvati** + **Reset**
  - **Klik na zbir** → popup sa listom stavki (artikl + količina). Dvoklik na red = briše čitavu stavku. Dugme OK.
  - **Prihvati** → kopira stavke u tabelu Stavke Deala → nastavak uobičajeno
  - **Reset** → briše sve artikle (setup od početka)
- **Postojeći layout:** klik na dugme može promijeniti stavku i boju tog dugmeta.

---

### 3.5 Layout SC – kreiranje layouta

- Prazna šahovka bez stavki
- Klik na dugme → popup cjenovnik → izaberi stavku → popup izbora boje (9 osnovnih boja)
- Dugme se oboji bojom i prikaže stavku
- **Footer:** **OK** (upiše naziv layouta, snimi) + **Odustani**

---

### 3.6 Deal – stavke

- U Deal-u postoji tabela **Stavke – određivanje budžeta** (sporija, preglednija)
- SC prihvati → kopira u tu tabelu. Rok, kontakti i ostalo se upisuju u standardnom prozoru Deal-a nakon što SC odradi svoj dio.

---

**Status:** Implementirano (02/2025). SQL: `scripts/create-sc-layouts.sql`

**Dodatak:** U Deal-u (inicijacije/[id]) dodati dugme za kreiranje budžeta putem SC – i za već otvoreni Deal. ✓ Implementirano – dugme SC u Stavke sekciji, link na SC sa ?inicijacija_id={id}.

---

## 4. SmartPhone layout

- **Pojednostavljena** verzija – ne sve iz Fluxa
- **StrategicCore** kao glavni alat

**Status:** Implementirano. Ruta `/mobile` – minimalni home sa StrategicCore kao glavnim dugmetom; link na Fluxa (puna verzija). Dashboard i StrategicCore imaju link na Mobile.

---

## 5. Promet i troškovi – tabele i grafovi (2006+)

**Cilj:** Prikaz kao na referentnim slikama – tabele po godinama/mjesecima, grafovi, izbor metrika.

**Izvor podataka:**
- **Promet (prihodi):** `projektni_prihodi` (projekat_id, datum, iznos_km)
- **Troškovi:** `projektni_troskovi` (projekat_id, datum_troska, iznos_km)
- **Projekti:** od 2006 (created_at / rok_glavni)

**Prikaz u tabelama:**
- Redovi: godine (2006 – tekuća)
- Kolone: januar … decembar + ukuno + prosjek mjesečno
- Trend indikator (strelica gore/dole) za prosjek po godini

**Izbor šta prikazati:**
- **Metrika:** Promet (prihodi) | Troškovi | Oba (2 tabele)
- **Filter:** Svi projekti | Po projektu | Po klijentu (grupa projekata)
- **Opcija:** "TAF" / "UKUPNO" – ako postoji logika za segmente (npr. klijent TAF vs ostali)

**Grafovi (opciono):**
- Bar chart: mjesečni prihodi po godinama (cluster po godini)
- Bar chart: godišnji total
- Poređenje godine sa prethodnom
- Trend linija

**Ruta:** `/finance/izvjestaji` ili `/studio/izvjestaji` – na razradu pri implementaciji.

**Status:** Grafički (promet/troškovi/zarada) implementiran. Dashboard → Izvještaji → Grafički.

---

## 5b. Izvještaji – talenti, dobavljači, klijenti, banka

**Širi set izvještaja:** po talentima (koliko projekata, ukupno zaradili, dug), po dobavljačima, po klijentima/narrediocima, troškovi banke (provizije, održavanje, SWIFT), fakturna vrijednost/naplate po periodu, fiksni vs prihod.

**Detaljan plan:** `docs/PLAN_IZVJESTAJI.md`

---

## 6. Popuna šifarnika (prije finalne faze)

- Unos referentnih podataka u radnici, roles, users, klijenti, cjenovnik, radne faze, dobavljači, talenti itd.
- Lakše je testirati i demo-vati kad sve ostalo radi
- **Redoslijed:** prije uvoda korisnika i kontrola pristupa

---

## 7. Finalna faza: Korisnici, uloge i nivoi pristupa

*Na kraju, kad je sve ostalo gotovo.*

- Login stranica, session, middleware
- Hash lozinke (bcrypt)
- Povezivanje users ↔ roles ↔ radnici
- Nivoi pristupa – šta ko vidi (viewer, operator, manager, admin)
- UI skrivanje linkova prema nivou
- API zaštita

**Detaljan plan:** `docs/PLAN_AUTH_ROLES.md`

---

## Napomene

- Svaki korak će se detaljirati kad do njega dođemo
