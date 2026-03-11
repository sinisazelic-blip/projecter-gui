# Dokumentacija Fluxe

Pregled dostupne dokumentacije u repou (folder **docs/Fluxa_docs/**).

---

## Korisničko uputstvo u aplikaciji

Uputstvo je **puno** — sve sekcije su popunjene na srpskom i engleskom, s prekidačem jezika (i18n preko cookie `NEXT_LOCALE`).

- **Stranica u aplikaciji:** [**/uputstvo**](/uputstvo) — korisnik može doći preko linka na Dashboardu ili prečacem **F1**.
- **Izvorni sadržaj (kod):**
  - **`src/app/uputstvo/content-sr.ts`** — sekcije na srpskom (BiH).
  - **`src/app/uputstvo/content-en.ts`** — iste sekcije na engleskom.
- **Stranica:** `src/app/uputstvo/page.tsx` — prikazuje sadržaj prema trenutnom jeziku.

Izvorni tekst uputstva u repou (Markdown, kao izvor istine ili za eventualni PDF export):

- **UPUTSTVO-KORISNIKA-SR.md** — puno uputstvo na srpskom.
- **UPUTSTVO-KORISNIKA-EN.md** — puno uputstvo na engleskom.

### Kako mijenjati sadržaj uputstva

1. **U aplikaciji (prikaz na /uputstvo):**  
   Uredi `src/app/uputstvo/content-sr.ts` i/ili `content-en.ts`. Svaki odjeljak ima `title` i `content`. U `content` možeš koristiti jednostavan HTML (npr. `<p>`, `<ul>`, `<strong>`).

2. **U repou (Markdown):**  
   Uredi `UPUTSTVO-KORISNIKA-SR.md` i `UPUTSTVO-KORISNIKA-EN.md` u ovom folderu ako želiš da Markdown ostane izvor istine ili za export.

---

## First-run onboarding (uvodna tura)

Aplikacija ima **first-run onboarding** za nove korisnike: pri prvom pristupu nakon kreiranja naloga prikazuje se kratka uvodna tura.

- **Kada se pokreće:** Samo za korisnike koji još nisu prošli turu (po korisniku; stanje se čuva u **audit_log**, event `onboarding_completed`, bez nove tabele).
- **Šta tura pokriva (koraci, na engleskom):** Welcome → Your desk → Deals (link) → Create a deal (dugme na listi) → Budget & line items (na detalju deala) → Projects (PP) → Finance & Profit → You're all set.
- **Ponašanje:** Tamni overlay s „rupom“ oko označenog elementa, pulsirajući ring (highlight), popup s objašnjenjem; korisnik sam klikće i navigira. U topbaru na Dashboardu uvijek postoji **Skip tour** dok je tura aktivna; Finish ili Skip zapiše završetak u audit i više se ne prikazuje.
- **Gdje je u kodu:** Konfiguracija koraka: `src/lib/onboarding-steps.js`. Komponenta: `src/components/OnboardingTour.tsx`, wrapper: `OnboardingTourWrapper.jsx`. Targeti u UI: `data-onboarding="desk"`, `"deals"`, `"pp"`, `"profit"` (Dashboard), `"new-deal"` (lista inicijacija), `"deal-stavke"` (detalj deala). API: `GET /api/auth/me` vraća `onboarding_completed`; `POST /api/auth/onboarding-complete` bilježi završetak u **audit_log**. Da bi se stanje „prošao onboarding” pamtilo nakon reloada, u bazi mora postojati tabela **onboarding_completed** – v. **scripts/create-onboarding-completed.sql** (pokreni jednom na bazi).

---

## Ostali važni dokumenti (u ovom folderu)

| Dokument | Za šta služi |
|----------|----------------|
| **LISTA_DO_GO_LIVE.md** | Lista stvari koje treba završiti / provjeriti prije go-live. |
| **PLAN_DEPLOY_I_INSTALACIJA.md** | Postavljanje Fluxe na DO host, env varijable na serveru, nginx, PM2, instalacioni paket za nove klijente. |
| **FLUXA-V1-FISKAL-NAPOMENE.md**, **FLUXA-FISKAL-PROBA.md** | Fiskalna integracija (ESIR, napomene, proba). Detaljnije u **fiskal/** (PDF-ovi, tehnička dokumentacija). |
| **I18N_FULL_UI_I_VAT.md**, **I18N_LOKAL_KAO_TRZISTE.md**, **PLAN_JEZICI_I_PRETPLATA.md** | Jezici u UI, valute (KM/EUR), tržišta i pretplata. |
| **LISTA-DOKUMENTACIJE-OSTALO.md** | Šta je u dokumentaciji gotovo, šta ostaje (checklist). |
| **DEVELOPER-README.md** | Developer onboarding: šta prvo pročitati, kako pokrenuti, struktura projekta (app, lib, API, baza), auth, i18n, ključni moduli. |
| **STATE.md** | State i razvojni put (GUI moduli, principi). |
| **API_CONTRACTS.md** | API ugovori. |
| **DB_MAP.md**, **ANALIZA-BAZE-DO.md** | Baza: mapiranje, analiza. |

Ostali fajlovi iz gradnje projekta (stari planovi, bilješke) nalaze se u **docs/arhiva/**. Korijenski **README.md** u rootu projekta sadrži link na ovaj pregled i na **PLAN_DEPLOY_I_INSTALACIJA.md** za one koji rade na kodu i deployu.
