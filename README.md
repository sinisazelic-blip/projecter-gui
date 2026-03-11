# Fluxa · Project & Finance Engine

**Fluxa** je operativni kontrolni sistem namijenjen kreativnim studijima i marketinškim agencijama. Povezuje cijeli životni ciklus rada u jednoj jasnoj niti: Deal → Projekt → Faktura → Stvarni profit. Umjesto više odvojenih alata za prodaju, projekte i finansije, Fluxa sve objedinjuje u jedan operativni sistem.

---

## Za korisnike Fluxe (klijenti)

Korisnici **ne instaliraju** aplikaciju. Fluxa administrator im dostavlja **link** do zakupljene instance i **login podatke**. Potrebni su im samo **pristup internetu** i **web preglednik**. Nema podešavanja na njihovom računaru — sve je „ključ u ruke”.

---

## Za razvoj i održavanje

Ovaj repozitorij koriste oni koji rade na kodu i dizanju Fluxe na hosting (DO server itd.). Umjetničke radionice i agencije ne rade održavanje — to radi vaš tim (ili angažovani developer kojeg vi uputite).

### Zahtjevi (lokalni razvoj)

- **Node.js** LTS (npr. 20+)
- **npm**
- **MySQL** (na produkciji već postoji na DO serveru)

### Varijable okruženja (`.env.local`)

Za lokalni rad kreiraj u rootu projekta **`.env.local`**. Aplikacija očekuje sljedeće (obavezne za rad):

| Varijabla | Opis |
|-----------|------|
| `DB_HOST` | MySQL host |
| `DB_USER` | MySQL korisnik |
| `DB_PASSWORD` | MySQL lozinka |
| `DB_NAME` | Ime baze |
| `DB_PORT` | Port (opciono; default 3306; na DO često 25060) |
| `AUTH_SECRET` ili `SESSION_SECRET` | Tajna za session cookie (min. 16 znakova) |

Opcione / po potrebi:

| Varijabla | Opis |
|-----------|------|
| `UPLOAD_PATH` | Folder za upload logotipa (default: `public/logos`) |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | Bazni URL aplikacije (za linkove u mailu itd.) |
| `FLUXA_OWNER_TOKEN` | Token za owner pristup (Blagajna, owner-login) |
| `ENABLE_TENANT_ADMIN` | `"true"` za tenant admin (server) |
| `NEXT_PUBLIC_ENABLE_TENANT_ADMIN` | `"true"` da se u UI prikaže tenant admin (klijent) |
| `DEFAULT_TENANT_ID` | Default tenant ID kad je tenant admin uključen |
| `LICENCE_CHECK_URL` | URL za provjeru licence (LicenceCheckWrapper) |
| `LICENCE_TOKEN` | Token za licence check |
| `PB_SALT` / `PB_SEED` | Seed/salt za wizard (fakture) |

Ako nedostaje `AUTH_SECRET`/`SESSION_SECRET`, login će vratiti grešku; u UI se prikaže poruka da u `.env.local` dodaš `AUTH_SECRET=...` i restartuješ server.

### NPM skripte

| Komanda | Namjena |
|---------|--------|
| `npm run dev` | Dev server (Next.js, webpack), [http://localhost:3000](http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Pokretanje production builda (nakon `npm run build`) |
| `npm run lint` | Biome check |
| `npm run format` | Biome format (write) |

### Pokretanje u dev okruženju

```bash
npm install
# Kreirati .env.local (DB_*, AUTH_SECRET) — vidi tablicu iznad
npm run dev
```

Otvori [http://localhost:3000](http://localhost:3000). Za produkciju (DO): vidi **[docs/Fluxa_docs/PLAN_DEPLOY_I_INSTALACIJA.md](docs/Fluxa_docs/PLAN_DEPLOY_I_INSTALACIJA.md)** (upload, `npm run build`, `npm run start`, nginx, PM2, env na serveru).

### Struktura repozitorija

| Putanja | Namjena |
|---------|--------|
| **src/app/** | Next.js App Router: stranice, API rute, layouti |
| **src/app/page.js** | Početna (redirect / login ili dashboard) |
| **src/app/dashboard/** | Dashboard (centralna konzola, linkovi na module) |
| **src/app/projects/** | Projekti (lista, detalj [id], faze) |
| **src/app/inicijacije/** | Deals / inicijacije (ponude, otvaranje projekta) |
| **src/app/ponude/** | Ponude |
| **src/app/fakture/** | Fakture (lista, wizard, preview) |
| **src/app/finance/** | Finansije (banka, KUF, PDV, prihodi, plaćanja, profit, fiksni troškovi, itd.) |
| **src/app/banking/** | Banka (import, pravila) |
| **src/app/naplate/** | Naplate |
| **src/app/studio/** | Šifarnici i postavke (firma, klijenti, radnici, talenti, dobavljači, uloge, licence, Strategic Core, cjenovnik, radne faze) |
| **src/app/mobile/** | Mobilna verzija (StrategicCore, deals, pp) |
| **src/app/uputstvo/** | Korisničko uputstvo (sr/en, i18n), stranica `/uputstvo` |
| **src/app/api/** | API rute (auth, projekti, fakture, banka, izvještaji, import, tenant-admin, itd.) |
| **src/lib/** | Zajednička logika: `db.ts` (MySQL pool), `auth/` (session, owner, permissions), `i18n.js`, `translations.js`, `api.js`, bank/cash moduli, itd. |
| **src/components/** | UI komponente (AuthUserProvider, LocaleProvider, FluxaLogo, GlobalTooltip, UputstvoShortcut, itd.) |
| **src/locales/** | Prijevodi: `sr.json`, `en.json` |
| **scripts/** | SQL skripte (migracije, seed, alter tabele), backup/import skripte, demo |
| **docs/Fluxa_docs/** | Planovi, deploy upute, tehnička dokumentacija, korisničko uputstvo (Markdown) |
| **public/** | Statički fajlovi (npr. `/fluxa/` logo, ikone) |

Baza: **MySQL**; konekcija preko `src/lib/db.ts` (pool). Session: cookie `fluxa_session`, potpis preko `AUTH_SECRET`/`SESSION_SECRET` (`src/lib/auth/session.ts`). Jezici: cookie `NEXT_LOCALE` (sr/en), prijevodi iz `src/locales/`.

### Detaljnija dokumentacija (linkovi)

| Dokument | Sadržaj |
|----------|--------|
| **[docs/Fluxa_docs/README-DOKUMENTACIJA.md](docs/Fluxa_docs/README-DOKUMENTACIJA.md)** | Pregled dokumentacije, uputstvo u aplikaciji (content-sr/content-en), ostali dokumenti |
| **[docs/Fluxa_docs/README.md](docs/Fluxa_docs/README.md)** | Kratki opis Fluxe (produkt) |
| **[docs/Fluxa_docs/PLAN_DEPLOY_I_INSTALACIJA.md](docs/Fluxa_docs/PLAN_DEPLOY_I_INSTALACIJA.md)** | Postavljanje na DO, env na serveru, nginx, PM2, instalacioni paket za nove klijente |
| **[docs/Fluxa_docs/LISTA_DO_GO_LIVE.md](docs/Fluxa_docs/LISTA_DO_GO_LIVE.md)** | Lista stvari do go-live |
| **[docs/Fluxa_docs/API_CONTRACTS.md](docs/Fluxa_docs/API_CONTRACTS.md)** | API ugovori |
| **[docs/Fluxa_docs/DB_MAP.md](docs/Fluxa_docs/DB_MAP.md)** | Mapiranje baze |
| **[docs/Fluxa_docs/DEVELOPER-README.md](docs/Fluxa_docs/DEVELOPER-README.md)** | Developer onboarding: šta prvo pročitati, struktura, API, baza, auth |
| **[docs/Fluxa_docs/STATE.md](docs/Fluxa_docs/STATE.md)** | State i razvojni put (GUI moduli) |
| **[docs/Fluxa_docs/LISTA-DOKUMENTACIJE-OSTALO.md](docs/Fluxa_docs/LISTA-DOKUMENTACIJE-OSTALO.md)** | Šta je gotovo / šta ostaje (dokumentacija) |
| **docs/Fluxa_docs/UPUTSTVO-KORISNIKA-SR.md** / **-EN.md** | Izvorni tekst korisničkog uputstva (Markdown) |
| **docs/Fluxa_docs/** (PLAN_*, I18N_*, fiskal/) | Planovi, i18n, fiskalna dokumentacija |

Sve u **[docs/Fluxa_docs/](docs/Fluxa_docs/)** — za planove, deploy, bazu, API i onboard novog developera koristi ove linkove.
