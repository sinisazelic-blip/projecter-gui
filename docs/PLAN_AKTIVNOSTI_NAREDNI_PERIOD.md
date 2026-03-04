# Plan aktivnosti u narednom periodu

*Sastavljeno: 17.02.2026. Obuhvata konceptualno dogovorene korake (prodaja licenci, admin tenant centar, user model) i ranije planirane nedovršene zadatke. Referenca za implementaciju.*

---

## Pregled

Plan je podijeljen u:

1. **Prodaja licenci i kontrolna konzola (admin tenant centar)** – koncept dogovoren u razgovoru; način implementacije po tačkama.
2. **Ranije planirano, nedovršeno** – fiskalizacija, čišćenje baze, i18n, user management (uključujući Saradnik), dokumentacija, tooltip, export prazne baze, poslovanje Studio TAF.
3. **Redoslijed i zavisnosti** – predloženi slijed rada.

Detaljniji koncepti: **PLAN_JEZICI_I_PRETPLATA.md**, **I18N_LOKAL_KAO_TRZISTE.md**, **FLUXA-V1-FISKAL-NAPOMENE.md**, **UPUTSTVO-PRIPREMA-USER-MANAGEMENT.md**.

---

# 1. Prodaja licenci i admin tenant centar

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
- **Implementacija:** Koristiti postavke iz `firma_fiskal_settings` (Base URL, EsirKey, PIN). Wizard korak 2/3: ako automatska fiskalizacija → poziv API-ja uređaja; u fakturu upisati PFR broj i ostale elemente; na PDF-u ispod stavki prikazati blok „FISKALNI RAČUN” (QR, PFR vrijeme, PFR broj, brojač, KRAJ FISKALNOG RAČUNA). Kad je ručno – nema bloka, PFR ostaje u headeru kao sada. PFR broj za sljedeću fakturu: koristiti ono što PU vrati (n+1).

## 2.2 Čišćenje baze – testovi i arhiva

- **Cilj:** Ukloniti sve test podatke (projekti, dialovi, ponude, izvodi, itd.). Ostaviti **samo arhivu** svih projekata do 31.12.2025.
- **Provjera:** Posljednji arhivirani projekat – pretpostavlja se **#5753** (provjeriti u bazi).
- **Poslije čišćenja:** Kad Fluxa krene u upotrebu, prvi sljedeći projekat je **#5754**. Prva faktura: **001/2026**. PFR **51** (ili onaj koji PU RS vrati pri prvoj automatskoj fiskalizaciji – v. FLUXA-V1-FISKAL-NAPOMENE).
- **Implementacija:** Backup baze; skripta ili ručno brisanje test projekata, deals, ponuda, izvoda koji nisu dio arhive; zadržati projekte arhivirane do 31.12.2025. Brojač faktura i PFR postaviti u skladu s gore navedenim.

## 2.3 Završetak lokalizacije (i18n)

- **Cilj:** Lokalizacija = **lokal (tržište)**, ne samo jezik. Prvo EU (valuta EUR, VAT, terminologija: Sales Ledger, Purchase Ledger, itd.), kasnije GB (funte), USA (USD), CH (CHF) – svako tržište svojim pravilima i oznakama. Otvorena mogućnost za dodavanje novih lokalizacija i jezika.
- **Detalji:** Vidi **I18N_LOKAL_KAO_TRZISTE.md**, **PLAN_JEZICI_I_PRETPLATA.md** (pogl. 1 i 2).
- **Implementacija:** Rad **jedan prozor po jedan**: za svaki prozor – stringovi u locale fajlovima (sr + en, s pravom terminologijom za tržište) + logika (valuta, porez, formati) ovisna o lokalu. Konfiguracija po regionu (stope VAT, valute, obavezna polja) – config ili tenant/postavke. Ne samo zamjena teksta, nego i prilagodba ponašanja.
- **Status (23.02.2026):** Prilagodba/prevod na i18n (zamjena UI stringova, sr + en) **završena** za sve planirane Studio stranice i šifarnike. Sljedeći korak: pregled i popravke; zatim dalje po redu (lokal = tržište, valuta/VAT po potrebi).

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
- **Implementacija:** Pregled postojećih tooltipova (title, aria-label, custom komponenta); povećati font/veličinu i kontrast; uvesti konzistentnu komponentu (npr. `Tooltip`) i koristiti je na ključnim akcijama. Opciono: i18n za tekstove tooltipova (locale).

## 2.7 Export prazne SQL baze (struktura) za novi tenant

- **Cilj:** Imati **praznu SQL bazu** (samo struktura, bez podataka) spremnu za upload pri konfiguraciji novog klijenta (tenanta). Kad se deploy-uje Fluxa za novog zakupca, baza se kreira iz te šeme.
- **Implementacija:** Export schema-only (npr. `pg_dump --schema-only` za PostgreSQL ili ekvivalent za drugi RDBMS). Snimiti na lokalan računar i/ili u repo (npr. `scripts/schema-empty.sql`). Verzionirati; pri dodavanju novih tabela/migracija ažurirati tu šemu. Možda pripremiti **ranije** – prije nego što se krene u prodaju – da je odmah spremna za prve klijente.

## 2.8 Poslovanje – Studio TAF i troškovi

- **Konstatacija:** Prodaja Fluxe ulazi u **poslovanje Studio TAF-a** (pravno lice, nosilac prava fakturisanja); prihod od licenci ide u prihod Studija. Troškovi zakupa (DO – serveri, baze, protok) definitivno se obračunavaju iz poslovanja Studija.
- **Šta pripremiti:** Pravno i računovodstveno – kako se evidentira prihod od licenci, kako se troškovi DO alociraju. Eventualno **ranije** pripremiti (ugovori, cjenovnici, interne smjernice) da kad prva prodaja dođe sve bude usklađeno. Nije direktno zadatak u kodu, ali dio plana aktivnosti.

---

# 3. Redoslijed i zavisnosti

Predloženi redoslijed (može se prilagoditi):

| Red | Zadatak | Napomena |
|-----|---------|----------|
| 1 | Čišćenje baze (2.2) | Da imate „čistu” arhivu i jasne brojeve (#5754, 001/2026, PFR). |
| 2 | Automatski fiskalni račun (2.1) | Završetak fiskalnog toka u fakturi prije go-live. |
| 3 | Export prazne SQL baze (2.7) | Spremno za konfiguraciju novog tenanta; može ranije. |
| 4 | Tenant + plan + subscription (1.2) | Baza i logika za tenante, planove, datume isteka; provjera pri loginu. |
| 5 | Admin modul (1.2) | Vaša super verzija – modul za listu tenanata, produženje, promjena plana; build/config za client verziju bez modula. |
| 6 | User management + Saradnik (2.4) | Uloge, prava, limit saradnika po tenantu. |
| 7 | i18n lokalizacija (2.3) | Jedan prozor po jedan, lokal = tržište. |
| 8 | Tooltip (2.6) | Uočljiviji, zamjena za help. |
| 9 | Dokumentacija i User manual (2.5) | Za nove korisnike. |
| – | Poslovanje Studio TAF (2.8) | Priprema ranije po potrebi, paralelno s ostalim. |
| – | Online plaćanje (PayPal Business, webhook) | Nakon prve prodaje; unutar godinu dana. |

---

# 4. Reference na postojeće planove

- **FLUXA_KANONSKI_PRIKAZ.md** – kanonski spisak: šta Fluxa trenutno radi i šta će raditi kad završimo (sve u jednom mjestu).
- **PLAN_JEZICI_I_PRETPLATA.md** – jezici, tržišta, pretplata, cjenovni razredi.
- **I18N_LOKAL_KAO_TRZISTE.md** – zašto lokal = tržište, kako raditi prozor po prozor.
- **I18N_FULL_UI_I_VAT.md** – raniji i18n status; sada usmjereno prema I18N_LOKAL_KAO_TRZISTE.
- **FLUXA-V1-FISKAL-NAPOMENE.md** – fiskalni uređaj, wizard, fiskalni blok na PDF-u.
- **UPUTSTVO-PRIPREMA-USER-MANAGEMENT.md** – uloge, moduli, ko šta vidi i smije; dorada za Saradnika.

---

*Kraj plana. Ažurirati ovaj dokument kako se zadaci realizuju.*
