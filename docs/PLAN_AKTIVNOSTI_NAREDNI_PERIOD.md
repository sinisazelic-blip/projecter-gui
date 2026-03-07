# Plan aktivnosti u narednom periodu

*Sastavljeno: 17.02.2026. Obuhvata konceptualno dogovorene korake (prodaja licenci, admin tenant centar, user model) i ranije planirane nedovršene zadatke. Referenca za implementaciju.*

---

## Status realizacije (23.02.2026)

**Urađeno danas:**

| Stavka | Status |
|--------|--------|
| **Čišćenje baze (2.2)** | ✅ Završeno. Obrisani testni podaci 2026: fakture, ponude, deal timeline, inicijacije, blagajna stavke, projektni troškovi (jan–feb 2026), testni projekti (od #5754). Arhiva (projekti do #5753) ostala. |
| **Backup baze** | ✅ Skripta `scripts/backup-studio-db.bat` + upute za Workbench; backup radi iz MySQL Workbencha. |
| **Tenant / Licence sistem (1.2)** | ✅ Implementirano: tabele `plans` i `tenants` (s `licence_token`), modul Licence (Dashboard → 🔐 Licence), lista tenanata, Produži / Promijeni plan / Suspend / Vrati pristup, Novi tenant, token (kopiraj / regeneriši). **Licence check:** klijentska Fluxa šalje token prema master API-ju (`/api/public/licence-check`); ako `allowed: false` (suspendovano ili isteklo), prikazuje se blok stranica. Sve kontrolišete iz konzole. Docs: **MASTER_FLUXA_NOVI_KORISNICI.md**. |
| **Tooltip (2.6)** | ✅ Završeno. Globalni custom tooltip presreće sve `title` atribute; veći font (15px / 18px na 4K), čitljiv na običnim i 4K displejima; tooltip služi kao svojevrsni help. Pojedinačne korekcije po potrebi. |

**Na čekanju / sljedeće:**

| Stavka | Napomena |
|--------|----------|
| **Fiskalni uređaj (2.1)** | **Čekamo dodatna pojašnjenja** (format zahtjeva, obavezna polja, poruka greške) od developera / servisera prije nastavka implementacije. |
| **Ostalo iz plana** | V. sekciju „Šta nam je ostalo” na kraju dokumenta. |

---

## Pregled

Plan je podijeljen u:

1. **Prodaja licenci i kontrolna konzola (admin tenant centar)** – koncept dogovoren u razgovoru; način implementacije po tačkama.
2. **Ranije planirano, nedovršeno** – fiskalizacija, čišćenje baze, i18n, user management (uključujući Saradnik), dokumentacija, tooltip, export prazne baze, poslovanje Studio TAF.
3. **Redoslijed i zavisnosti** – predloženi slijed rada.

Detaljniji koncepti: **PLAN_JEZICI_I_PRETPLATA.md**, **I18N_LOKAL_KAO_TRZISTE.md**, **FLUXA-V1-FISKAL-NAPOMENE.md**, **UPUTSTVO-PRIPREMA-USER-MANAGEMENT.md**.

---

# 1. Prodaja licenci i admin tenant centar

**Status (23.02.2026):** ✅ **Implementirano.** Tabele `plans` i `tenants` (s `licence_token`), modul Licence (Dashboard → 🔐 Licence), lista tenanata, Produži / Promijeni plan / Suspend / Vrati pristup, Novi tenant, token (prikaz, kopiraj, regeneriši). Provjera pretplate pri loginu (redirect na „Pretplata je istekla”). **Licence check:** klijentska instanca u .env ima `LICENCE_CHECK_URL` i `LICENCE_TOKEN`; pri učitavanju pita master API; ako suspendovano ili isteklo → blok stranica („Obratite se administratoru Fluxe”). V. **MASTER_FLUXA_NOVI_KORISNICI.md**.

## 1.1 Koncept (kratki rezime)

- **Jedna Fluxa** u podlozi za sve: isti kod. Za klijente (zakupce) deploy je **client verzija** (bez modula za upravljanje tenentima). Vaša instanca = **super verzija** s tim modulom.
- **Plan po tenantu:** Light / Full (i eventualno drugi). Promjena plana u admin modulu = tenant odmah vidi odgovarajuće module (nema posebnog uploada „Full” verzije).
- **Admin konzola** (tenanti, licence, broj korisnika, datumi isteka): svi imaju kod, ali po **pravima** je vide samo vi (platform admin). Po klijentima deploy-ujete Fluxu koja taj modul **nema** ili ga konfiguracijom sakrivate (`ENABLE_TENANT_ADMIN=false`).
- **Prazna baza** – vi je uploadujete kod sebe; po klijentima – njihova baza, njihov deploy, bez admin modula.

## 1.2 Implementacija – šta uvesti

| Zadatak | Opis implementacije |
|--------|----------------------|
| **Tenant (organizacija)** | Tabela `tenants`: naziv, `plan_id` (ili `max_users` + `plan_type`: Light/Full), `subscription_starts_at`, `subscription_ends_at`, status. Svaki korisnik i svi podaci (projekti, fakture, firma, …) vezani za `tenant_id`. |
| **Planovi** | Tabela `plans`: npr. `plan_id`, naziv (Starter, Growth, Light, Full), `max_users`, `max_saradnici` (v. 2.4), `features` (koji moduli vidljivi – npr. JSON ili bitmask). Tenant ima `plan_id`. |
| **Provjera pri loginu** | Ako `now > subscription_ends_at` → blokirati pristup, redirect na stranicu „Produžite pretplatu” (ili prikaz poruke). Provjera na **backendu** (middleware / API). |
| **Admin modul (samo vaša instanca)** | Novi modul u meniju (naziv kasnije – npr. „Licence”, „Organizacije”) vidljiv samo ako `user.role === 'platform_admin'` ili sl. Lista tenanata: naziv, plan, korisnika X/Y, isteče za Z dana, status. Akcije: produži (ažuriraj `subscription_ends_at`), promijeni plan (Light↔Full, ažuriraj `max_users` / `plan_id`). |
| **Build / konfiguracija** | Na vašem serveru: env ili config `ENABLE_TENANT_ADMIN=true`. Na klijentskim deploy-ima: `ENABLE_TENANT_ADMIN=false` – modul se ne prikazuje i nije dostupan. Ili poseban build flavor „client” bez tog modula. |
| **Export prazne baze** | V. sekciju 2.7 – struktura baze (schema only) za upload pri konfiguraciji novog tenanta. |
| **Online plaćanje (kasnije)** | PayPal Business (ili sl.) – webhook na uspješnu uplatu: produženje → ažuriraj `subscription_ends_at`; nadogradnja (više licenci) → ažuriraj `max_users` ili `plan_id`. Prva kupnja (novi tenant) može ostati ručna (vi podesite u narednih nekoliko sati). |

## 1.3 Napomena o nazivu

- Naziv za admin funkciju (upravljanje tenentima) – da ne bude „vlasnik Fluxe” – ostaje za kasniju odluku (npr. „Platforma”, „Licence”, „Organizacije”).

---

# 2. Ranije planirano, nedovršeno

## 2.1 Automatski fiskalni račun u sastavu Fluxa fakture

- **Cilj:** Fiskalni uređaj (L-PFR API) povezan s Fluxom; pri izboru „DA” za automatsku fiskalizaciju u wizardu – poziv prema uređaju, odgovor (QR, PFR broj, vrijeme, brojač) snimiti u fakturu i prikazati **fiskalni blok** na PDF-u.
- **Detalji:** Vidi **FLUXA-V1-FISKAL-NAPOMENE.md** (poglavlja 2 i dalje).
- **Status (23.02.2026):** Čekamo odgovor developera (OFS / serviser) na pitanja o formatu zahtjeva i poruci greške (400 Bad Request). **Implementacija planirana za ponedjeljak.** Fiskalni blok na PDF-u (layout) već pripremljen; API poziv treba uskladiti s odgovorom.
- **Implementacija (kad stigne spec):** Koristiti postavke iz `firma_fiskal_settings`. Wizard: ako automatska fiskalizacija → poziv API-ja; u fakturu upisati PFR broj i ostale elemente; na PDF-u blok „FISKALNI RAČUN” (QR, PFR vrijeme, broj, brojač, KRAJ).

## 2.2 Čišćenje baze – testovi i arhiva

- **Cilj:** Ukloniti sve test podatke (projekti, dialovi, ponude, izvodi, itd.). Ostaviti **samo arhivu** svih projekata do 31.12.2025.
- **Status (23.02.2026):** ✅ **Završeno.** Korištene skripte: `scripts/clean-2026-test-data.sql` (fakture, ponude, inicijacije, blagajna), `scripts/clean-2026-troskovi.sql` (projektni troškovi jan–feb 2026), `scripts/clean-2026-test-projekti.sql` (projekti od #5754). Backup: `scripts/backup-studio-db.bat` + Workbench opcije. Arhiva (projekti do #5753) ostala.

## 2.3 Završetak lokalizacije (i18n)

- **Cilj:** Lokalizacija = **lokal (tržište)**, ne samo jezik. Prvo EU (valuta EUR, VAT, terminologija), kasnije GB, USA, CH – svako tržište svojim pravilima i oznakama.
- **Status (23.02.2026):** ✅ **Završeno.** Dvojezična varijanta (sr + en), bira se na dugme. Dalje proširenje (lokal = tržište, valuta/VAT po regionu) po potrebi.

## 2.4 User management i profil „Saradnik”

- **Cilj:** Uvesti user management u Fluxu (uloge, prava po modulima). Uvesti profil **Saradnik**: vanjski saradnik, vidi samo svoje projekte (dodijeljene), kratka posjeta (npr. 10–20 min). **Limit saradnika** po tenantu da se ne zloupotrebljava (npr. svi radnici kao „saradnici”).
- **Detalji:** Vidi **UPUTSTVO-PRIPREMA-USER-MANAGEMENT.md** (uloge, moduli, ko šta vidi i smije).
- **Implementacija:**  
  - Uloge (Guest, Viewer, Operator, Manager, Admin) prema uputstvu; dodati ulogu **Saradnik** s ograničenim pristupom (samo dodijeljeni projekti, bez šifarnika, bez finansija itd.).  
  - U planu tenanta: npr. `max_saradnici` (apsolutni limit ili multiplikator tipa 2× broj punih mjesta). Pri dodavanju korisnika s ulogom Saradnik: provjera da broj saradnika < limit; inače poruka „Dostignut limit saradnika, nadogradite paket”.  
  - Opciono: praćenje aktivnosti saradnika (npr. prekomjerna upotreba → upozorenje ili pravilo da takvi prelaze u „puno mjesto”).

## 2.5 Kompletna dokumentacija i User manual

- **Cilj:** Dokumentacija sistema i **user manual za nove korisnike** (kako koristiti Fluxu po modulima, šta je šta).
- **Implementacija:** Strukturirati dokumente (npr. po modulima), napisati korak-po-korak upute, screenshoti gdje korisno. Moguće držati u `docs/` ili posebnom repozitoriju / wiki; format (Markdown, PDF, web) po želji.

## 2.6 Tooltip (zamjena za help)

- **Cilj:** Na funkcijska dugmad (i gdje god ima smisla) pri prelasku mišem prikazati **tooltip** – kratko objašnjenje šta dugme radi. Tooltip treba biti **uočljiviji** (trenutno previše sitan); treba da bude zamjena za help gdje je moguće.
- **Status (17.02.2026):** ✅ **Završeno.** Globalni custom tooltip (`GlobalTooltip.jsx`) presreće sve native `title` atribute; prikazuje ih većim fontom (15px, na 4K 18px), čitljivo na običnim i 4K displejima. Pojedinačne korekcije teksta/prikaza po potrebi.
- **Implementacija (urađeno):** Presretanje `title` u layoutu; CSS klasa `.fluxa-global-tooltip` u globals.css; media query za 4K.

## 2.7 Export prazne SQL baze (struktura) za novi tenant

- **Cilj:** Imati **praznu SQL bazu** (samo struktura, bez podataka) spremnu za upload pri konfiguraciji novog klijenta (tenanta). Kad se deploy-uje Fluxa za novog zakupca, baza se kreira iz te šeme.
- **Implementacija:** Export schema-only (npr. `pg_dump --schema-only` za PostgreSQL ili ekvivalent za drugi RDBMS). Snimiti na lokalan računar i/ili u repo (npr. `scripts/schema-empty.sql`). Verzionirati; pri dodavanju novih tabela/migracija ažurirati tu šemu. Možda pripremiti **ranije** – prije nego što se krene u prodaju – da je odmah spremna za prve klijente.

## 2.8 Poslovanje – Studio TAF i troškovi

- **Konstatacija:** Prodaja Fluxe ulazi u **poslovanje Studio TAF-a** (pravno lice, nosilac prava fakturisanja); prihod od licenci ide u prihod Studija. Troškovi zakupa (DO – serveri, baze, protok) definitivno se obračunavaju iz poslovanja Studija.
- **Šta pripremiti:** Pravno i računovodstveno – kako se evidentira prihod od licenci, kako se troškovi DO alociraju. Eventualno **ranije** pripremiti (ugovori, cjenovnici, interne smjernice) da kad prva prodaja dođe sve bude usklađeno. Nije direktno zadatak u kodu, ali dio plana aktivnosti.

---

# 3. Redoslijed i zavisnosti

Predloženi redoslijed (ažurirano 23.02.2026):

| Red | Zadatak | Status |
|-----|---------|--------|
| 1 | Čišćenje baze (2.2) | ✅ Završeno |
| 2 | Automatski fiskalni račun (2.1) | ⏳ Čekamo odgovor developera; implementacija u ponedjeljak |
| 3 | Export prazne SQL baze (2.7) | 📋 Ostalo |
| 4 | Tenant + plan + subscription (1.2) | ✅ Završeno |
| 5 | Admin modul + licence check (1.2) | ✅ Završeno |
| 6 | User management + Saradnik (2.4) | 📋 Ostalo |
| 7 | i18n lokalizacija (2.3) | ✅ Završeno (dvojezično, bira se na dugme) |
| 8 | Tooltip (2.6) | ✅ Završeno |
| 9 | Dokumentacija i User manual (2.5) | 📋 Ostalo |
| – | Poslovanje Studio TAF (2.8) | Priprema po potrebi, paralelno |
| – | Online plaćanje (PayPal, webhook) | Nakon prve prodaje |

---

# 4. Šta nam je ostalo

**Na čekanju (traže se pojašnjenja):**

- **Fiskalni uređaj (2.1)** – za nastavak implementacije potrebna su **dodatna pojašnjenja** (format zahtjeva, obavezna polja, poruka greške) od developera / servisera. Dok to ne stigne, ovaj zadatak ne krećemo.

**Šta još imamo raditi (osim fiskalnog uređaja):**

1. **Export prazne SQL baze (2.7)** – schema-only export za novi tenant; spremno za prve klijente.
2. **User management + Saradnik (2.4)** – uloge, prava po modulima, profil Saradnik, limit saradnika po tenantu.
3. **Dokumentacija i User manual (2.5)** – korak-po-korak za nove korisnike.

*(Tooltip (2.6) je završen.)*

**Kasnije / po potrebi:**

- Poslovanje Studio TAF (2.8) – pravno/računovodstveno za licence i DO troškove.
- Online plaćanje (webhook za produženje pretplate).
- **Promo / video:** angažovan videograf – passthrough i video materijali za promo Fluxe kad aplikacija bude gotova.
- **Web portal Fluxe** – javna stranica u Fluxa stilu (engleski, opušteno, umjetnički ton): informacije, cjenovnik, demo (link na app.studiotaf.xyz Demo/Guest), login za korisnike, samousluga licenci, podrška. V. **FLUXA_PORTAL_SPEC.md**.

---

# 5. Reference na postojeće planove

- **MASTER_FLUXA_NOVI_KORISNICI.md** – kako vezati kupce licence, licence check, Suspend, token.
- **FLUXA_KANONSKI_PRIKAZ.md** – kanonski spisak: šta Fluxa trenutno radi i šta će raditi kad završimo (sve u jednom mjestu).
- **PLAN_JEZICI_I_PRETPLATA.md** – jezici, tržišta, pretplata, cjenovni razredi.
- **I18N_LOKAL_KAO_TRZISTE.md** – zašto lokal = tržište, kako raditi prozor po prozor.
- **I18N_FULL_UI_I_VAT.md** – raniji i18n status; sada usmjereno prema I18N_LOKAL_KAO_TRZISTE.
- **FLUXA-V1-FISKAL-NAPOMENE.md** – fiskalni uređaj, wizard, fiskalni blok na PDF-u.
- **UPUTSTVO-PRIPREMA-USER-MANAGEMENT.md** – uloge, moduli, ko šta vidi i smije; dorada za Saradnika.

---

*Kraj plana. Ažurirati ovaj dokument kako se zadaci realizuju.*
