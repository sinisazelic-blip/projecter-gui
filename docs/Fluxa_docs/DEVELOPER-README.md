# Fluxa — Developer onboarding i tehnička dokumentacija

Kratak, konciznan vodič za developere koji dolaze u projekat: šta prvo pročitati, kako pokrenuti aplikaciju, gdje je šta u kodu i kako su povezani ključni dijelovi sistema.

---

## 1. Šta prvo pročitati

| Dokument | Sadržaj |
|----------|--------|
| **Korijenski [README.md](../README.md)** | Šta je Fluxa, zahtjevi, env varijable, NPM skripte, kratka struktura, link na docs. |
| **[STATE.md](STATE.md)** | Cilj projekta, principi (baza = source of truth, sve preko API-ja), moduli GUI-a, razvojni put (read-only → operativno). |
| **[API_CONTRACTS.md](API_CONTRACTS.md)** | Konvencije API-ja (base `/api`, format odgovora), ugovori po domeni (projekti, klijenti, troškovi, plaćanja, fiksni, fakture). Napomena: u kodu postoje i brojne rute koje su dodane nakon ovog dokumenta — puna lista je u strukturi `src/app/api/` ispod. |
| **[DB_MAP.md](DB_MAP.md)** | Mapiranje baze: klijenti, projekti, projektni_troskovi, placanja, fiksni_troskovi, fakture, talenti, dobavljaci, users, roles, radne_faze. Relacije i ključne kolone. |
| **[PLAN_DEPLOY_I_INSTALACIJA.md](PLAN_DEPLOY_I_INSTALACIJA.md)** | Priprema prije upload-a, deploy na DO, env na serveru, prazna baza, novi tenant, licence. |
| **[../DEPLOY_DIGITALOCEAN.md](../DEPLOY_DIGITALOCEAN.md)** | **Produkcija:** redovan tok `git push main` → App Platform (studio/studiotaf), ručni redeploy, SSH + `git pull` + PM2 kada DO ne povuče kod. |
| **[ANALIZA-BAZE-DO.md](ANALIZA-BAZE-DO.md)** | Stanje baze na DO (tabele, view-ovi), kritične napomene (npr. brojac_faktura), preporuke za optimizaciju. |

---

## 2. Zahtjevi i pokretanje

- **Node.js** LTS (npr. 20+), **npm**, **MySQL** (pristup: host, user, password, database).
- **`.env.local`** u rootu: obavezno `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` (opciono), `AUTH_SECRET` ili `SESSION_SECRET` (min. 16 znakova). Puni spisak u [README.md](../README.md).
- **Pokretanje:** `npm install` → popuni `.env.local` → `npm run dev`. Aplikacija: [http://localhost:3000](http://localhost:3000). Login bez `AUTH_SECRET` vraća grešku; poruka u UI upućuje na dodavanje u `.env.local` i restart.

---

## 3. Struktura projekta (detaljno)

### 3.1 `src/app/` — Next.js App Router

Sve stranice i API rute su ovdje. Rute su file-based: `app/dashboard/page.js` → `/dashboard`, `app/api/auth/login/route.ts` → `POST /api/auth/login`.

**Stranice (UI):**

| Putanja / folder | Namjena |
|------------------|--------|
| `page.js` (root) | Početna: login forma; link na owner-login. |
| `dashboard/` | Centralna konzola: Desk (Deals, SC, PP), Finansije, Šifarnici, Firma. Top actions: licence, verzija, mobile, blagajna, uputstvo, odjava. |
| `projects/` | Lista projekata (filteri, pretraga). `projects/[id]/` — detalj projekta (status, troškovi, faze, FINAL OK). `projects/[id]/faze/` — Gantt faze. `projects/[...slug]/` — catch-all (npr. close project). |
| `inicijacije/` | Deals: lista, `[id]` detalj deala, ponuda-wizard, otvaranje projekta. |
| `ponude/` | Lista ponuda. |
| `ponuda/[id]/preview/` | Preview ponude. |
| `fakture/` | Lista faktura. `fakture/wizard/` — wizard (korak 1–3). `fakture/[id]/` — detalj; `fakture/[id]/preview/` — pregled. `fakture/za-fakturisanje/` — izbor za fakturisanje. |
| `naplate/` | Naplate (bankovni izvodi, match). |
| `finance/` | Finansije: `page.js` (ulaz), `prihodi/`, `dugovanja/`, `potrazivanja/`, `placanja/`, `banka/`, `kuf/`, `krediti/`, `pdv/`, `cashflow/`, `banka-vs-knjige/`, `fiksni-troskovi/`, `pocetna-stanja/`, `profit/`, `otpis`. |
| `banking/` | Banka: import, pravila (rules). |
| `izvjestaji/` | Izvještaji: `svi/`, `graficki/`. |
| `izvodi/` | Izvodi (pregled). |
| `studio/` | Šifarnici i postavke: `firma`, `klijenti`, `talenti`, `dobavljaci`, `cjenovnik`, `radnici`, `radne-faze`, `users`, `roles`, `licence`, `strategic-core`, `finance-tools`. |
| `mobile/` | Mobilna verzija: dashboard, `deals/`, `pp/` (pregled projekata). |
| `cash/` | Blagajna (owner / token). |
| `uputstvo/` | Korisničko uputstvo: `page.tsx`, `content-sr.ts`, `content-en.ts` (i18n). Stranica `/uputstvo`, link na Dashboardu i F1. |
| `owner-login/` | Owner token login (verzija, opcije). |
| `subscription-expired/` | Blokirana stranica kad licence nije dozvoljena (LicenceCheckWrapper). |

**Layout i globalno:** `layout.js` — LocaleProvider, FluxaEditionProvider, AuthUserProvider, ThemeProvider, LicenceCheckWrapper, SubscriptionGuard, GlobalTooltip, UputstvoShortcut, **OnboardingTourWrapper** (first-run uvodna tura za nove korisnike; v. docs README-DOKUMENTACIJA.md, sekcija First-run onboarding). `global-error.tsx` — global error boundary.

### 3.2 `src/app/api/` — API rute

Sve rute su pod `src/app/api/`; svaka ruta ima `route.js` ili `route.ts` (GET/POST/… prema exportu).

**Auth i session:**  
`auth/login`, `auth/logout`, `auth/me`, `auth/onboarding-complete`. Session: cookie `fluxa_session`, potpis preko `AUTH_SECRET`/`SESSION_SECRET` (v. `src/lib/auth/session.ts`). Na zaštićenim rutama čita se cookie i `verifySessionToken()`. **Onboarding:** `GET /api/auth/me` u payloadu vraća `onboarding_completed` (iz `audit_log`, event `onboarding_completed`); `POST /api/auth/onboarding-complete` bilježi završetak first-run ture za trenutnog korisnika (bez nove tabele).

**Projekti i faze:**  
`projects/route.js` (lista), `projects/[id]/route.js` (detalj), `projects/[id]/status`, `projects/[id]/costs`, `projects/[id]/faze/route.js`, `projects/[id]/faze/[fazaId]/route.js`, `projects/[id]/close`, `projects/[id]/close-check`, `projects/[id]/final-ok`, `projects/[id]/final-ok-check`, `projects/[id]/storno`, `projects/[id]/pro-bono`, `projects/[id]/audit`, `projects/search`.

**Inicijacije (Deals) i ponude:**  
`inicijacije/route.ts`, `inicijacije/[id]/route.ts`, `inicijacije/[id]/valuta`, `inicijacije/stavke`, `inicijacije/stavke/batch`, `inicijacije/timeline`, `inicijacije/convert`, `inicijacije/otvori-projekat`. `ponude/route.ts`, `ponude/[id]/route.ts`, `ponude/wizard-data`.

**Fakture:**  
`fakture/list`, `fakture/[id]/route.ts`, `fakture/[id]/storno`, `fakture/create`, `fakture/za-fakturisanje`, `fakture/wizard/preview-data`, `fakture/wizard/seed`, `fakture/fiskalizuj`.

**Finansije:**  
`finance/prihodi`, `finance/dugovanja`, `finance/potrazivanja`, `finance/placanja`, `finance/krediti`, `finance/kuf`, `finance/valute`, `finance/postings/*` (link-payment, unlinked, deactivate-payment-link), `finance/pocetna-stanja`, `finance/pocetna-stanja/import`, `finance/pocetna-stanja/template`, `finance/otpis/*`, `finance/banka-vs-knjige`, `finance/pdv-prijava`, `finance/krediti`.  
`pocetna-stanja/route.ts`. `naplate/route.js`, `naplate/save`.

**Banka (import, match, commit):**  
`bank/import/route.js`, `bank/import/bam`, `bank/import/xml-v2`, `bank/transactions`, `bank/commit`, `bank/batches`, `bank/batches/[batch_id]/stats`, `bank/batches/stats`, `bank/match`, `bank/match/list`, `bank/match/apply`, `bank/match/unmatched`, `bank/match/rule`, `bank/rules`, `bank/rules/[rule_id]`, `bank/rules/preview`, `bank/costs/commit`, `bank/costs/rollback`.

**Izvještaji:**  
`izvjestaji/projekti`, `izvjestaji/klijenti`, `izvjestaji/talenti`, `izvjestaji/dobavljaci`, `izvjestaji/fakture-period`, `izvjestaji/fakture-naplate`, `izvjestaji/knjiga-prihoda`, `izvjestaji/pdv`, `izvjestaji/banka`, `izvjestaji/fiksni-troskovi`, `izvjestaji/potrazivanja`, `izvjestaji/margin-by-klijent`.

**Šifarnici / studio:**  
`firma/active`, `firma/save`, `firma/logo`, `firma/upload-logo`, `firma/brojac-faktura`, `firma/fiskal`. `klijenti/route.ts`, `cjenovnik/route.ts`, `narucioci/route.ts`. `radnici/save`, `studio/radnici/[id]/projekti`. `studio/import/klijenti`, `studio/import/dobavljaci`, `studio/import/talenti`.  
`sc/layouts`, `sc/layouts/[id]`.  
`talents/route.js`, `tipovi/route.js`, `cost-types/route.js`, `costs/types/route.js`, `costs/types/create`.  
`project-statuses/route.ts`.  
`db-tables`, `db-columns`, `db-query` (dev).

**Tenant admin i licence:**  
`tenant-admin/tenants/route.ts`, `tenant-admin/tenants/[id]/route.ts`, `tenant-admin/plans/route.ts`. Zahtijevaju `ENABLE_TENANT_ADMIN=true` i session.  
`public/licence-check/route.ts` — javni endpoint za provjeru licence (tenant instance zove master; v. LicenceCheckWrapper). **`public/licence-extend/route.ts`** — siguran POST za produženje licence na osnovu uplate (portal / webhook); zahtijeva `FLUXA_LICENCE_EXTEND_SECRET`; v. **PLAN_PAYMENT_EXTEND_LICENCE.md**.

**Ostalo:**  
`owner/verify` (FLUXA_OWNER_TOKEN). `fx/route.js`, `fx/upsert`. `env-check` (dev: prikaz env bez tajni). `ping`.  
`import/*` (dobavljaci_text, talenti_text, troskovi_talent_angazmani, talenti).  
`debug/*` (sql, columns-projektni-troskovi, showcreate-*, fakture-iznosi, set-test-project), `_debug/schema/*`.  
`narudzbenice/send`.

### 3.3 `src/lib/` — Zajednička logika

| Fajl / folder | Namjena |
|---------------|--------|
| **db.ts** | MySQL pool (mysql2/promise). Obavezne env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME; opciono DB_PORT. Export: `pool`, `query<T>(sql, params)`. Transient greške (ECONNRESET, ETIMEDOUT, Pool closed) retry-aju se jednom. |
| **auth/session.ts** | Session token: createSessionToken, verifySessionToken. Cookie: fluxa_session, maxAge 7 dana. Potpis: AUTH_SECRET ili SESSION_SECRET (min 16 znakova). getSessionCookieAttributes za Set-Cookie. |
| **auth/owner.ts** | Provjera FLUXA_OWNER_TOKEN (owner login). |
| **auth/normalize-password.ts** | Normalizacija lozinke pri login-u. |
| **auth/permissions-matrix.ts** | Matrica prava: modul → (inPage) → nivo → Permission (demo/hide/Read Only/Show/Use/Edit/all). Generirano iz Excel-a (scripts/generate-permissions-from-excel.js). LEVELS, getPermission, canSee. |
| **auth/route-permission.ts** | Mapiranje pathname → (module, inPage). ROUTE_TO_MODULE lista; getRequiredPermission(pathname). Zaštita ruta u AuthUserProvider. |
| **api.js** | getAppUrl() — NEXT_PUBLIC_APP_URL, APP_URL, VERCEL_URL. |
| **api/routeWrap.ts**, **api/response.ts** | Pomoc za API odgovore. |
| **i18n.js** | Cookie NEXT_LOCALE (sr/en). getValidLocale, getLocaleFromDocument, setLocaleInDocument, getCurrencyForLocale (sr→KM, en→EUR). |
| **translations.js** | getT(locale) za server-side prijevode (sr.json, en.json). |
| **bank/** | parseBamXmlV2, parseEurXmlV2; routes: commit, rollback, bankCommit. Bank import i knjiženje. |
| **cash/store.ts**, **cash/db.ts** | Blagajna: store i pristup bazi. |
| **pocetna-stanja.ts** | Logika početnih stanja. |
| **pdv-prijava.js** | PDV prijava. |
| **datetime.ts**, **format.ts** | Formatiranje datuma i brojeva. |
| **audit.ts** | Audit log. |
| **fetchJsonSafe.ts** | Siguran fetch + JSON parse. |
| **fluxa-edition.js** | FLUXA_EDITIONS, edition state (localStorage). |
| **import-xlsx.ts** | Import XLSX. |
| **exportExcel.js** | Export Excel. |
| **ui/common-styles.css**, **ui/fluxaTimeline.js** | Zajednički UI stilovi i timeline. |
| **projects/close.ts** | Logika zatvaranja projekta. |
| **prisma.ts** | Prisma client (ako se koristi; većina projekta koristi mysql2 preko db.ts). |

### 3.4 `src/components/`

Provideri i globalni UI: **AuthUserProvider** (session, permissions, canSee, onboardingCompleted, completeOnboarding; zaštita ruta prema route-permission), **LocaleProvider** (locale, setLocale, t(key)), **ThemeProvider**, **FluxaEditionProvider**, **LicenceCheckWrapper** (LICENCE_CHECK_URL + LICENCE_TOKEN → poziv master API; ako allowed false → subscription-expired), **SubscriptionGuard**, **PerformanceMeasurePatch**, **GlobalTooltip**, **UputstvoShortcut** (F1 → /uputstvo), **OnboardingTourWrapper** / **OnboardingTour** (first-run uvodna tura: highlight + popup; konfiguracija u `lib/onboarding-steps.js`).  
Ostalo: **FluxaLogo**, **LanguageSwitcher**, **LoginForm** (u app/), **ConfirmSubmitButton**, **ColumnPicker**, **ReadOnlyGuard**, **DatePickers**, **StatusTimelineBar**, **CostTypeAndEntityPicker**, itd.

### 3.5 `src/locales/`

**sr.json**, **en.json** — ključevi po modulima (common, dashboard, nav, projects, fakture, finance, studio, mobile, itd.). Server: `getT(locale)` iz `lib/translations.js`. Klijent: `useTranslation()` iz LocaleProvider (t, locale, setLocale).

### 3.6 Ostalo u repou

- **scripts/** — SQL (create-*.sql, alter-*.sql), seed (seed-demo.js, seed-roles-from-excel.sql), backup/import (PowerShell/BAT), generate-permissions-from-excel.js.
- **public/** — statički fajlovi: `/fluxa/` (logo, ikone), `/uputstvo/` (slike za uputstvo), `/logos/`, `/templates/import/` (xlsx predlošci).
- **docs/Fluxa_docs/** — planovi, deploy, baza, API, STATE, DEVELOPER-README (ovaj dokument).

---

## 4. Baza podataka

- **Pristup:** Isključivo preko **`src/lib/db.ts`**: `import { query, pool } from "@/lib/db"`. Konekcija: env DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT.
- **Shema i mapa:** [DB_MAP.md](DB_MAP.md) — tabele, PK/FK, relacije. [ANALIZA-BAZE-DO.md](ANALIZA-BAZE-DO.md) — stanje na DO, napomene (npr. brojac_faktura).
- **Migracije / seed:** SQL skripte u **scripts/**; redoslijed za novu praznu bazu v. [PLAN_DEPLOY_I_INSTALACIJA.md](PLAN_DEPLOY_I_INSTALACIJA.md) (sekcija 0.3, 1.2). Demo: `scripts/seed-demo.js`, **DEMO_BAZA_I_PRIKAZ.md** (u ovom folderu).

---

## 5. Autentikacija i autorizacija

- **Session:** Cookie `fluxa_session`, HMAC potpis (AUTH_SECRET ili SESSION_SECRET). Payload: user_id, username, role_id, nivo, exp. Login: `api/auth/login` (username + password), postavlja cookie; logout briše cookie.
- **Zaštićene rute:** API rute koje zahtijevaju session čitaju cookie i zovu `verifySessionToken`; stranice provjeravaju pristup preko **AuthUserProvider** i **route-permission.ts** (pathname → modul → nivo → canSee). Ako korisnik nema pravo (hide/demo), preusmjerava se ili blokira.
- **Nivoi (roles):** Nivo 0 = Saradnik (samo Dashboard i PP u kojima učestvuje). Matrica prava u **permissions-matrix.ts** (generirana iz Excel-a).
- **Owner:** Poseban token FLUXA_OWNER_TOKEN; `api/owner/verify` za owner-login (verzija, opcije).
- **Tenant / licence:** Na klijentskoj instanci LICENCE_CHECK_URL + LICENCE_TOKEN; LicenceCheckWrapper poziva master; ako `allowed: false` → subscription-expired. V. [PLAN_DEPLOY_I_INSTALACIJA.md](PLAN_DEPLOY_I_INSTALACIJA.md) sekcija 0.5.

---

## 6. i18n i valuta

- **Jezik:** Cookie `NEXT_LOCALE` (sr | en). **LocaleProvider** nudi locale, setLocale, t(key). **getT(locale)** za server. Prijevodi u **src/locales/sr.json**, **en.json**.
- **Valuta po regiji:** **getCurrencyForLocale(locale)** u `lib/i18n.js`: sr → KM, en → EUR.

---

## 7. Ključni moduli (kratko)

- **Dashboard** — ulazna točka; linkovi na Deals, PP, Strategic Core, Finansije, Šifarnici, Firma; top actions (licence, mobile, blagajna, uputstvo, odjava).
- **Projekti (PP)** — lista projekata, filteri; detalj projekta: status, troškovi, faze (Gantt), FINAL OK. Statusi i zatvaranje projekta povezani su s Deal-om.
- **Deals (Inicijacije)** — pregovori; deal detalj, stavke, ponuda, otvaranje projekta (convert). Timeline i valuta.
- **Fakture** — wizard (izbor projekata → podešavanja → preview), lista, detalj, storno, fiskalizacija.
- **Finansije** — prihodi, dugovanja, potraživanja, plaćanja, banka, KUF, PDV, cashflow, fiksni troškovi, početna stanja, profit, otpis.
- **Banka** — import izvoda (BAM/EUR XML V2), transakcije, batch-ovi, match (pravila, apply), commit/rollback.
- **Studio** — firma (postavke, logo, brojač, fiskal), klijenti, talenti, dobavljači, cjenovnik, radnici, radne faze, users, roles, licence, Strategic Core.
- **Mobile** — pojednostavljena verzija: dashboard, deals, pp (pregled projekata).

---

## 8. Ostala dokumentacija

- [README-DOKUMENTACIJA.md](README-DOKUMENTACIJA.md) — pregled docs/, uputstvo u aplikaciji, važni dokumenti.
- [LISTA_DO_GO_LIVE.md](LISTA_DO_GO_LIVE.md), [LISTA-DOKUMENTACIJE-OSTALO.md](LISTA-DOKUMENTACIJE-OSTALO.md) — šta je gotovo / šta ostaje.
- Planovi: PLAN_*.md, I18N_*.md, fiskal (FLUXA-V1-FISKAL-NAPOMENE, folder fiskal/). Stari planovi: docs/arhiva/.

Ako nešto nije pokriveno ovdje, prvo provjeri **STATE.md**, **API_CONTRACTS.md** i **DB_MAP.md**, zatim konkretan modul u `src/app/` i odgovarajuće API rute u `src/app/api/`.
