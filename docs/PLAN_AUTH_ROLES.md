# Plan: Korisnici, uloge i nivoi pristupa

*Pregled šta imamo i šta treba za uvodenje korisnika i kontrola pristupa*

---

## 1. Šta već imamo

### 1.1 Tabele u bazi

| Tabela | Polja | Napomena |
|--------|-------|----------|
| **users** | user_id, username, password, grupa?, role_id?, aktivan?, last_login_at?, created_at, updated_at | `create-shifarnici` ima samo grupa; tvoja verzija ima role_id, aktivan, last_login_at |
| **roles** | role_id, naziv, nivo_ovlastenja/nivo_ovlascenja, opis | Radi podrška za oba pisanja |
| **radnici** | radnik_id, ime, prezime, adresa, broj_telefona, email, datum_rodjenja, jib, aktivan, opis | Šifarnik zaposlenih |

### 1.2 Povezanost

- **users.role_id** → roles.role_id (veza postoji)
- **users** ↔ **radnici**: **nema direktne veze**. Users ima `grupa`, radnici nisu povezani.

### 1.3 Studio UI

- `/studio/users` – Korisnici (CRUD, izbor role_id)
- `/studio/roles` – Uloge (CRUD, nivo ovlaštenja)
- `/studio/radnici` – Radnici (CRUD)

### 1.4 Auth (trenutno)

- **Nema login stranice** – aplikacija je otvorena
- **assertOwner** – samo `FLUXA_OWNER_TOKEN` + header `x-owner-token` za zaštićene API-ove (npr. Blagajna)
- Nema session, JWT, cookies

---

## 2. Šta treba implementirati

### Faza A: Priprema baze i veza

| # | Zadatak | Opis |
|---|---------|------|
| A1 | **users.radnik_id** (opciono) | FK na radnici – koja osoba (radnik) je ovaj korisnik? Korisno za "ulogovan je X, zaposleni Y" |
| A2 | **Hash lozinke** | Lozinka je plain text! Dodati bcrypt (ili argon2) pri kreiranju/izmjeni |
| A3 | **Migracija users** | Ako users nema role_id, aktivan, last_login_at – odraditi ALTER TABLE |

### Faza B: Login i session

| # | Zadatak | Opis |
|---|---------|------|
| B1 | **Login stranica** | `/login` – forma username + password |
| B2 | **Session** | NextAuth.js ili vlastiti JWT + httpOnly cookie |
| B3 | **Middleware** | Zaštita rutama – ako nema session → redirect na login |
| B4 | **Logout** | Čišćenje session-a |

### Faza C: Nivoi pristupa (šta ko vidi)

| # | Zadatak | Opis |
|---|---------|------|
| C1 | **Definicija nivoa** | Mapirati nivo_ovlastenja (0, 1, 2...) na konkretna prava, npr.: 0=viewer, 1=operator, 2=manager, 3=admin |
| C2 | **Permission matrix** | Tabela ili konfig: koja ruta / akcija zahteva koji nivo |
| C3 | **UI skrivanje** | Dashboard/links – prikazati samo ono što korisnik smije |
| C4 | **API zaštita** | Na serveru provjeriti nivo prije izvršavanja akcije |

### Faza D: Dodatno (opciono)

| # | Zadatak | Opis |
|---|---------|------|
| D1 | **User ↔ Radnik** | Polje radnik_id u users – povezati korisnika sa zaposlenim |
| D2 | **Last login** | Ažurirati last_login_at pri uspješnom loginu |
| D3 | **Audit** | changed_by_user_id u ključnim tabelama (inače NULL) |

---

## 3. Preporučeni redoslijed

1. **A2** – Hash lozinke (hitno za sigurnost)
2. **A3** – Provjera/popravka users tabele (role_id, aktivan, last_login_at)
3. **B1–B4** – Login + session + middleware
4. **C1–C2** – Definicija nivoa i permisija
5. **C3–C4** – UI skrivanje + API zaštita
6. **A1, D1–D3** – Po želji

---

## 4. Tehnički predlozi

### 4.1 Auth knjižnica

- **NextAuth.js** – gotovo rješenje, podržava credentials, session, middleware
- **Ili vlastiti** – JWT u httpOnly cookie, middleware provjerava

### 4.2 Nivoi (primjer)

| nivo | Naziv | Šta vidi/može |
|------|-------|---------------|
| 0 | Viewer | Samo čitanje – projekti, deals, izvještaji |
| 1 | Operator | + unos stavki, statusa, osnovne promjene |
| 2 | Manager | + zatvaranje projekata, budžet, finansije |
| 3 | Admin | Sve + šifarnici, korisnici, uloge, firma |

### 4.3 SQL za pripremu users (ako treba)

```sql
-- Provjeri kolone
SHOW COLUMNS FROM users;

-- Ako nedostaju:
ALTER TABLE users ADD COLUMN role_id INT NULL REFERENCES roles(role_id);
ALTER TABLE users ADD COLUMN aktivan TINYINT NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN radnik_id INT NULL REFERENCES radnici(radnik_id);
```

---

## 5. Guest / Demo profil (kasnije)

**Cilj:** Guest = demo prikaz Fluxe (marketing), ne pristup pravim podacima. Prikazati funkcionalnost, ne podatke.

**Opcije (jedna od):**
- **A)** Demo account s lažnim podacima – prikaz samo sample podataka.
- **B)** Demo „sandbox” baza – posebna baza sa sample podacima.
- **C)** Demo mod – link „Pogledaj demo” bez lozinke, session vidi samo sample podatke.

**Prijedlog (nije obavezno 10 dana rada):**
- Guest nema pristup podacima Studija (šifarnici, pravi projekti).
- Rezervisati nekoliko ID-eva (npr. projekat_id, deal_id) samo za demo/test.
- Kad se neko uloguje kao Guest (ili demo), upiše svoje test podatke; pri odjavi ili zatvaranju prozora **sve se briše** (samo podaci vezani za taj demo session / te rezervisane ID-eve).
- Implementacija kasnije, nakon osnovnog login + nivoa.

---

## 6. Radnik: „svoj prostor” u Fluxi, honorarac, projekti (kasnije + dio sada)

**Cilj:** Svaki radnik (zaposlen ili angažovan po projektu) ima svoj prostor u Fluxi – vidi projekte na kojima radi, rokove, da ne mora „nisi mi rekao da je rok blizu”.

**Planirano:**
- **Honorarac** – u šifarniku radnici checkbox „honorarac” (nije zaposlenik u studiju, angažovan po projektu).
- **Dodjela projekata** – radniku se dodjeljuju projekti koje vidi i u kojima radi (kasnije: eksplicitna tablica tipa radnik_projekti ili korištenje projekat_faza_radnici).
- **User ↔ Radnik** – opciono: user (login) povezan s radnikom; kad se uloguje, vidi „svoje” projekte i rokove.
- **Osnovni model:** radnik = ima pristup Fluxi (preko user accounta) i vidi samo svoje projekte; sve ostalo po matrici prava.

**U kartonu radnika (Studio / Radnici):** prikaz projekata na kojima je radnik angažovan – **implementirano** (lista projekata iz projekat_faza_radnici). Kasnije: dodati checkbox „honorarac” i (po želji) eksplicitnu dodjelu projekata.

---

## 7. Sljedeći korak

Rekni s kojom fazom želiš da krenemo – npr. hash lozinke, login stranica, ili definicija nivoa – pa ćemo to implementirati korak po korak.
