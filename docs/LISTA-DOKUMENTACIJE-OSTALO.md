# Lista dokumentacije – šta nam ostalo

*Za rad sutra. Kad ovo završimo, dogovor o onboardingu. Fiskalni uređaj u ponedjeljak.*

---

## Šta je već gotovo

- **Korisničko uputstvo u aplikaciji** — sve sekcije popunjene (sr + en), stranica `/uputstvo` s i18n.
- **Izvorni tekst uputstva** — `docs/UPUTSTVO-KORISNIKA-SR.md` i `docs/UPUTSTVO-KORISNIKA-EN.md` (korišteni za content-sr/content-en).
- **Svih 5 tačaka plana dokumentacije** — završeno (v. ispod).

---

## Dokumentacija — 5 tačaka (završeno)

### 1. README projekta (korijenski README.md) — ✅ Završeno

- Fluxa-specifičan README: šta je Fluxa, za korisnike / za razvoj, zahtjevi, env varijable, NPM skripte, struktura repozitorija, linkovi na docs.
- **Fajl:** `README.md` u rootu.

### 2. Pregled dokumentacije u docs/ (README-DOKUMENTACIJA.md) — ✅ Završeno

- Ažurirano: uputstvo puno (sr + en, i18n), content-sr.ts / content-en.ts, /uputstvo, tabela važnih dokumenata (LISTA_DO_GO_LIVE, PLAN_DEPLOY, fiskal, i18n, DEVELOPER-README, itd.).
- **Fajl:** `docs/README-DOKUMENTACIJA.md`.

### 3. Korisničko uputstvo – opciono proširenje — ✅ Završeno

- Screenshoti u `public/uputstvo/` (dashboard, deal, projekt, faktura), povezani u content-sr.ts i content-en.ts.
- PDF export ostaje opciono za kasnije.

### 4. Deploy i instalacija — ✅ Završeno

- PLAN_DEPLOY_I_INSTALACIJA.md ažuriran (env varijable usklađene s kodom, reference na scripts/).
- Dodana sekcija **0. Priprema prije upload-a na DO** (šta pripremiti, kod, prazna baza, novi tenant, postavljanje licence).

### 5. Tehnička dokumentacija (pregled za developere) — ✅ Završeno

- Kreiran **docs/DEVELOPER-README.md**: šta prvo pročitati, zahtjevi i pokretanje, detaljna struktura (app, api, lib, components, locales), baza, auth, i18n, ključni moduli, linkovi na ostalu dokumentaciju.

---

## Nakon dokumentacije

- ~~Dogovor oko **first-run onboardinga**~~ — **✅ Implementirano.** Uvodna tura za nove korisnike (bolje od prvobitno planiranog): highlight + popup, korak po korak; završetak u `audit_log`. Detalji u **README-DOKUMENTACIJA.md** i **DEVELOPER-README.md**.
- ~~**Dokumentacija / User manual (2.5)**~~ — **✅ Gotovo.** Uputstvo u aplikaciji (/uputstvo, sr+en, screenshoti) + Fluxa onboarding pokrivaju korak-po-korak za nove korisnike.
- ~~**Povezivanje uplate s produženjem licence**~~ — **✅ Završeno.** Portal (DO) zove Master-Fluxu nakon PayPal uplate; endpoint POST /api/public/licence-extend. V. **PLAN_PAYMENT_EXTEND_LICENCE.md**.
- **Fiskalni uređaj** — kad budete u kancelariji (uređaj na lokaciji).
- **Export prazne baze** — schema za nove tenant-e (npr. scripts/schema-empty.sql).
- ~~**Poslovanje Studio TAF (2.8)**~~ — **✅ Odluke donesene.** V. **arhiva/POSLOVANJE-FLUXA-LICENCE-ODLUKE.md**.
- **Ostalo:** Samo **fiskalni uređaj** i **export prazne baze**. Portal Fluxe i promo/video u izgradnji (portal od iduće sedmice).

*Ažurirati ovu listu kako se stavke završavaju.*
