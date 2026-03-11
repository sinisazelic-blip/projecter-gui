# Deploy Fluxe na DigitalOcean App Platform

## 1. GitHub repozitorijum

- Na GitHubu (sinisazelic-blip) napravi **novi prazan repozitorijum** (npr. `projecter-gui`). Ne dodavaj README/licence (već postoje u projektu).

## 2. Lokalno: poveži i push

U rootu projekta (`projecter-gui`) pokreni (zamijeni `TvojGitHubUsername` ako koristiš drugi):

```powershell
cd "c:\Users\Studio\OneDrive\Desktop\projecter-gui"

# Poveži GitHub repo (ako si napravio projecter-gui)
git remote add origin https://github.com/sinisazelic-blip/projecter-gui.git

# Prvi push (tražit će se login/token za GitHub)
git push -u origin fix/status-flow
```

Ako želiš da DO gradi sa grane `main`, prvo gurni i main:

```powershell
git push origin fix/status-flow:main
```

Ili prebaci na main i pushuj:

```powershell
git checkout main
git merge fix/status-flow
git push -u origin main
```

## 3. DigitalOcean App Spec

U DO konzoli: **Apps → studio → App Spec → Edit**.

Za komponentu **studiotaf** (Web Service) postavi:

- **Repo:**  
  `https://github.com/sinisazelic-blip/projecter-gui.git`  
  (ili tačan URL repoa u koji si pushovao)

- **Branch:**  
  `main` (ili `fix/status-flow` ako deployuješ tu granu)

- **Build Command:**  
  `npm ci && npm run build`

- **Run Command:**  
  `npm run start`

Sačuvaj spec — pokreće se novi deploy.

## 4. Environment variables (studiotaf)

U **Settings → App-Level** ili **Component-Level** za studiotaf dodaj:

- `AUTH_SECRET` – bilo koji string (min. 16 znakova), npr. nasumična lozinka
- Ako baza nije automatski povezana: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (ili koristi DO “Attach Database” da DO ubaci varijable)

## 5. Nakon deploya

- Otvori **app.studiotaf.xyz** — treba da vidiš Fluxa (login), ne sample React.
- Ako build padne, u DO pogledaj **Build** log (ne samo Runtime).

---

## 6. Demo baza (opciono)

Ako želiš da **app.studiotaf.xyz** prikazuje demo podatke (klijenti, projekti, talenti iz `scripts/seed-demo.js`):

### 6.1 Kreirati demo bazu na DO

- U **Databases** → tvoj MySQL cluster → **Users & Databases**: kreiraj novu bazu npr. **studio_db_demo**.
- Isti MySQL korisnik može imati pristup i glavnoj i demo bazi (ili napravi posebnog korisnika samo za demo).

### 6.2 Struktura (tabele) u demo bazi

- Demo baza mora imati **istu shemu** kao glavna (sve tabele). Način:
  - Exportuj strukturu iz glavne baze (bez podataka) i importuj u **studio_db_demo**, ili
  - Pokreni iste migracije (create/alter skripte iz `scripts/`) na praznu **studio_db_demo**.

### 6.3 Pokrenuti seed (jednom)

Skripta `scripts/seed-demo.js` ubacuje demo klijente, projekte, talente, dobavljače, šifarnike.

**A) Lokalno prema DO bazi (najjednostavnije)**

1. U DO bazi uključi **Trusted Sources** za tvoju IP (ili privremeno 0.0.0.0/0 za test).
2. Lokalno napravi privremeni `.env.demo` (ili koristi `.env.local`):
   ```env
   DB_HOST=<DO MySQL host>
   DB_PORT=25060
   DB_USER=...
   DB_PASSWORD=...
   DB_NAME=studio_db_demo
   ```
3. Iz roota projekta:
   ```bash
   node scripts/seed-demo.js
   ```
   (Skripta čita `.env.local`; ako koristiš `.env.demo`, preimenuj ga u `.env.local` ili prilagodi skriptu da prima env fajl.)

**B) Ručno u MySQL klijentu**

Ako imaš pristup bazi preko DO Console ili MySQL Workbencha, možeš izvršiti INSERT-e iz `scripts/seed-demo.js` ručno (najčešće nije praktično zbog obima).

### 6.4 Jedna app, dva logina: studio i demo (preporučeno)

**Kako je dogovoreno:** Na **app.studiotaf.xyz** svi se loguju normalno; ako se neko uloguje sa **demo** / **demo** (ili klikne „Pogledaj demo”), Fluxa koristi **demo bazu**; svi ostali korisnici koriste **studio bazu**.

1. **Env varijable na DO** (za komponentu studiotaf):
   - **DB_NAME** = glavna (studio) baza, npr. `defaultdb` ili `studio_db`.
   - **DEMO_DB_NAME** = demo baza, npr. `studio_db_demo` (ista shema, seed-ovani demo podaci i korisnik `demo`).
   - Ostalo isto: DB_HOST, DB_USER, DB_PASSWORD, DB_PORT, AUTH_SECRET.

2. **Ponašanje:**
   - Login **demo** / **demo** (ili dugme „Pogledaj demo”) → autentifikacija prema **demo bazi**; session dobija `isDemo: true`; svi dalji upiti idu na **DEMO_DB_NAME**.
   - Bilo koji drugi login → autentifikacija prema **studio bazi**; upiti idu na **DB_NAME**.

3. **Seed demo baze:** Jednom pokrenuti `node scripts/seed-demo.js` prema **studio_db_demo** (lokalno sa env usmjerenim na DO, v. 6.3), da u demo bazi postoje korisnik `demo` i demo podaci.

4. **API rute:** Da demo korisnik uvijek vidi demo podatke, rute koje koriste bazu moraju raditi unutar „demo konteksta”. Urađeno je za: login, `/api/auth/me`, root layout, `/api/projects`. Ostale API rute koje koriste `query()` treba obaviti istim obrascem: koristiti `withDbSession(req, async (req, session) => { ... })` iz `@/lib/auth/with-db-session`.

### 6.5 Stare varijante (cijela app demo ili posebna instanca)

- **Cijela app je demo:** U env-u postavi samo `DB_NAME=studio_db_demo` (bez DEMO_DB_NAME). Tada cijela app uvijek radi na demo bazi.
- **Posebna demo instanca:** Drugi Web Service / app sa `DB_NAME=studio_db_demo` i drugom domenom (npr. demo.studiotaf.xyz).

Detaljniji opis demo podataka i šta seed ubacuje: **docs/Fluxa_docs/DEMO_BAZA_I_PRIKAZ.md**.
