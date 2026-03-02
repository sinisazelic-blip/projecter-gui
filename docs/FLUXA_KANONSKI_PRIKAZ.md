# Fluxa – kanonski prikaz: šta radi sada i šta će raditi

*Jedan spisak svega što je u Fluxi implementirano i funkcionalno do sada, te svega što smo dogovorili da će raditi kad završimo rad. Referenca za prezentaciju, planiranje i implementaciju. Ažurirano: 17.02.2026.*

---

## Uvod

Fluxa je **vertikalni sistem za agencije** (projekti, budžeti, klijenti, fakturisanje, naplate, finansije). Ovaj dokument sadrži:

1. **Šta Fluxa trenutno radi** – implementirano i funkcionalno.
2. **Šta će Fluxa raditi kad završimo rad** – dogovoreno u planovima i razgovorima (fiskalizacija, čišćenje baze, lokalizacija, prodaja licenci, user management, dokumentacija, itd.).

---

# 1. Šta Fluxa trenutno radi (implementirano i funkcionalno)

## 1.1 Dashboard

- Centralna konzola s linkovima prema glavnim modulima.
- Grupe: Desk (Projekti, Deals, PP), Finansije (Narudžbenice, Fakturisanje, Naplate, Dugovanja, Import izvoda, Izvodi, KIF, KUF, CashFlow, Krediti), Finansije analiza (Izvještaji – Svi, Grafički), Šifarnici (Cjenovnik, Talenti, Dobavljači, Klijenti, Radne faze, Radnici, Users, Roles, Firma).
- i18n: naslovi i dugmad preko prevoda (sr/en), ovisno o izboru jezika.

## 1.2 Projekti

- **Lista projekata** – filteri (godina, klijent, status, tip), pregled.
- **Detalj projekta** – osnovni podaci, troškovi, fakture, uplate, faze.
- **Faze projekta** – pregled i upravljanje radnim fazama (Gantt / timeline).
- Arhivirani projekti do 31.12.2025 (prije čišćenja baze – v. dio 2).

## 1.3 Inicijacije (Deals)

- Lista inicijacija (pregovori).
- Detalj inicijacije.
- Novo – kreiranje nove inicijacije.
- Ponuda-wizard – generisanje ponude iz inicijacije.

## 1.4 Finansije – hub i moduli

- **Finansije (hub)** – kartice za sve finance module s linkovima.
- **Banka** – kanonski ledger (postinzi); lista, detalj postinga.
- **PDV prijava** – obračun za period (izlazni − ulazni), spisak dokumenata; Od/Do, Osvježi, Prošli mjesec.
- **KUF (ulazne fakture)** – import i rasknjižavanje ulaznih faktura (projektni, fiksni, vanredni, investicije).
- **Potraživanja** – šta treba naplatiti; lista i detalj (linkovi na prihode, paid sum).
- **Dugovanja** – obaveze prema dobavljačima/talentima; lista, detalj, novo dugovanje.
- **Prihodi** – business prihodi; lista i detalj (linkovi na banku, potraživanja).
- **Plaćanja** – business plaćanja; lista i detalj (linkovi na banku, stavke).
- **CashFlow** – hronologija plaćanja, šta je sljedeće; fiksni troškovi po datumu.
- **Krediti** – pregled kreditnih obaveza (iznos, rate, uplaćeno, ostatak).
- **Početna stanja** – evidencija stanja na 31.12. (klijenti, dobavljači, talenti).
- **Fiksni troškovi** – šifrarnik i raspored dospijeća (read-only raspored).
- **Banka vs knjige** – usporedba stanja po izvodima i po internoj evidenciji (kontrola).

## 1.5 Izvodi i banking

- **Izvodi** – lista bankovnih izvoda; filteri (račun, datum Od/Do); Export u Excel; **Import izvoda** (link u topblocku).
- **Banking import** – uvoz izvoda (BAM XML v2) + matching transakcija.
- **Banking rules** – stranica za pravila (ako postoji).

## 1.6 KIF (fakture – izlazne)

- **Lista faktura** – filteri (broj, naručilac), Export u Excel.
- **Za fakturisanje** – odabir projekata i naručioca, period; prelazak u wizard.
- **Wizard (2/3)** – osnovno (datum, valuta, PDV režim, PFR, fiskalizacija DA/NE, poziv na broj, popust), grupisanje projekata, nazivi projekata na fakturi, opisne stavke; generisanje poziva na broj (AUTO); prelazak na preview.
- **Wizard preview (3/3)** – simulacija papira/PDF-a; opcija Fiskalizuj (ako je fiskalizacija uključena), Kreiraj račun, Kreiraj PDF; nakon kreiranja – prikaz kreirane fakture.
- **Detalj fakture** – pregled izdate fakture.
- **Preview fakture** – PDF prikaz; Štampaj, Save as PDF, Storno (ako nije storno).
- **Storno** – kreiranje storno računa (negativni iznosi), projekti se vraćaju u status Zatvoren.
- Brojač faktura po godini (Studio → Firma); PFR broj (ručni unos u wizardu ili – kad bude implementirano – automatski od uređaja).

## 1.7 Ponude (predračuni)

- **Lista ponuda** – filteri, Export u Excel.
- **Preview ponude** – PDF prikaz; Štampaj, Save as PDF, Pošalji mailom (ako postoji).

## 1.8 Naplate

- Stranica „Šta dospijeva i šta kasni” – projekti status 4/6, neplaćeno.

## 1.9 Narudžbenice

- Lista narudžbenica; preview.

## 1.10 Izvještaji

- **Svi izvještaji** – odabir tipa (Potraživanja, Lista faktura, Knjiga prihoda, PDV, Talenti, itd.), period, Generiši, Export.
- **Grafički izvještaj** – promet, troškovi i zarada po godinama i mjesecima.

## 1.11 Studio (šifarnici i postavke)

- **Firma** – identitet studija (naziv, pravni naziv, adresa, logo, bankovni računi); **Brojač faktura** (zadnji broj prije Fluxe po godini); **Postavke fiskalnog uređaja** (Base URL, EsirKey, PIN – za buduću automatsku fiskalizaciju); izbor **jezika** (Srpski / English).
- **Klijenti** – lista, CRUD; INO klijent (BiH) / VAT treatment (EN); PDV oslobođen, napomena.
- **Cjenovnik** – stavke cjenovnika.
- **Talenti** – lista talenta.
- **Dobavljači** – lista dobavljača.
- **Radnici** – lista radnika.
- **Radne faze** – faze projekata.
- **Users** – korisnici (bez punog user management / uloga za sada).
- **Roles** – uloge (priprema za user management).
- **Strategic Core** – brzi budžet u pregovorima.
- **Finance Tools** – pomoćni alati (ako postoji).

## 1.12 Blagajna (Cash)

- Interna blagajna (owner-only signal); dostupno iz navigacije.

## 1.13 Mobile

- Pojednostavljena mobilna verzija (StrategicCore / mobile dashboard).

## 1.14 i18n (djelimično)

- Izbor jezika u Studio → Firma (Srpski / English); cookie `NEXT_LOCALE`.
- Dio UI prebačen na prevode (dashboard, finance hub, firma, klijenti, fakture lista, ponude lista, izvodi, banking import, wizard, preview stranice, pojedine finance stranice, izvještaji). Ostalo: puna lokalizacija po tržištu (valuta, VAT, terminologija) – v. dio 2.

## 1.15 Tehnički stub

- Next.js App Router; API rute za bazu; autentifikacija (session); baza kao source of truth; valuta u prikazu KM (BAM). Postavke fiskalnog uređaja i brojač faktura u bazi (`firma_fiskal_settings`, `brojac_faktura`).

---

# 2. Šta će Fluxa raditi kad završimo rad (dogovoreno)

Sve navedeno u ovom odjeljku je **planirano i dogovoreno**; implementacija slijedi **PLAN_AKTIVNOSTI_NAREDNI_PERIOD.md** i povezane dokumente.

## 2.1 Automatski fiskalni račun

- **Povezivanje fiskalnog uređaja (L-PFR API)** s Fluxom preko postavki u Studio → Firma (Base URL, EsirKey, PIN).
- U wizardu fakture (korak 2/3): ako je izabrano **DA** za automatsku fiskalizaciju – poziv prema uređaju; odgovor (QR kod, PFR broj, PFR vrijeme, brojač) snimiti u fakturu i prikazati **fiskalni blok** na PDF-u (ispod stavki: FISKALNI RAČUN, QR, PFR vrijeme, PFR broj, brojač, KRAJ FISKALNOG RAČUNA).
- Ako je **NE** (ručno) – kao dosad: ručni PFR u headeru, nema fiskalnog bloka na PDF-u.
- PFR broj za sljedeću fakturu: koristiti ono što PU vrati (n+1).  
- *Detalji: FLUXA-V1-FISKAL-NAPOMENE.md.*

## 2.2 Čišćenje baze i go-live brojevi

- Ukloniti sve **test podatke** (projekti, dialovi, ponude, izvodi, itd.). Ostaviti **samo arhivu** projekata do 31.12.2025.
- Provjeriti posljednji arhivirani projekat (pretpostavlja se **#5753**).
- **Nakon čišćenja:** prvi sljedeći projekat **#5754**, prva faktura **001/2026**, PFR **51** (ili onaj koji PU RS vrati pri prvoj automatskoj fiskalizaciji).

## 2.3 Lokalizacija (lokal = tržište)

- **Lokalizacija = lokal (tržište)**, ne samo jezik. Prvo **EU** (valuta EUR, VAT, terminologija: Sales Ledger, Purchase Ledger, Buyer, itd.), kasnije **GB** (funte), **USA** (USD), **Švicarska** (CHF) – svako tržište svojim pravilima, stopama i oznakama.
- Otvorena mogućnost za **dodavanje novih lokalizacija i jezika**. Rad **jedan prozor po jedan** (stringovi + logika po lokalu).  
- *Detalji: I18N_LOKAL_KAO_TRZISTE.md, PLAN_JEZICI_I_PRETPLATA.md.*

## 2.4 User management i profil Saradnik

- **Uloge** (Guest, Viewer, Operator, Manager, Admin) s pravilima po modulima – ko šta vidi i smije (unos, edit, delete, storno, itd.).
- **Profil Saradnik** – vanjski saradnik, vidi **samo svoje dodijeljene projekte**, kratka posjeta (npr. 10–20 min); bez pristupa šifarnicima i punim finansijama.
- **Limit saradnika** po tenantu (npr. `max_saradnici` u planu) da se ne zloupotrebljava (da svi radnici ne budu „saradnici”). Pri dodavanju saradnika: provjera da broj saradnika < limit; inače poruka da se nadogradi paket.  
- *Detalji: UPUTSTVO-PRIPREMA-USER-MANAGEMENT.md, PLAN_AKTIVNOSTI_NAREDNI_PERIOD.md (2.4).*

## 2.5 Prodaja licenci i admin tenant centar

- **Jedna Fluxa** u podlozi za sve. Za klijente (zakupce) deploy = **client verzija** (bez modula za upravljanje tenentima). Vaša instanca = **super verzija** s tim modulom.
- **Tenant (organizacija)** – svaki zakupac ima tenant (naziv, plan, datumi pretplate). Svi podaci (projekti, fakture, firma, korisnici) vezani za `tenant_id`.
- **Planovi** – npr. Light / Full (i drugi); definiraju `max_users`, `max_saradnici`, koji moduli su vidljivi. Promjena plana u admin modulu = tenant odmah vidi odgovarajuće module (nema posebnog uploada).
- **Pretplata** – `subscription_starts_at`, `subscription_ends_at`. Pri loginu: ako je istekla → blokada ili redirect na „Produžite pretplatu”.
- **Admin modul (samo vaša super verzija)** – modul za upravljanje tenentima: lista tenanata (naziv, plan, korisnika X/Y, isteče za Z dana, status), akcije **produži** (ažuriraj datum isteka), **promijeni plan** (npr. Light → Full, više licenci). Kod je u svima, ali po **pravima** (ili konfiguraciji) vide ga samo vi; na client deploy-ima modul isključen (`ENABLE_TENANT_ADMIN=false` ili build bez modula).
- **Export prazne SQL baze** – struktura baze (schema only) spremna za upload pri konfiguraciji novog klijenta (novi tenant).
- **Online plaćanje (kasnije)** – PayPal Business (ili sl.); webhook na uspješnu uplatu: **produženje** → automatski ažurira `subscription_ends_at`; **nadogradnja** (više licenci) → ažurira `max_users` / plan. Prva kupnja (novi tenant) može ostati ručna (vi podesite u narednih nekoliko sati).  
- *Detalji: PLAN_AKTIVNOSTI_NAREDNI_PERIOD.md (pogl. 1), PLAN_JEZICI_I_PRETPLATA.md (pogl. 3).*

## 2.6 Dokumentacija i User manual

- **Kompletna dokumentacija** sistema i **user manual za nove korisnike** – kako koristiti Fluxu po modulima, šta je šta; korak-po-korak upute, screenshoti gdje korisno.

## 2.7 Tooltip (zamjena za help)

- Na funkcijska dugmad (i gdje ima smisla) pri prelasku mišem – **tooltip** s kratkim objašnjenjem. Tooltip **uočljiviji** (trenutno previše sitan); treba da bude zamjena za help gdje je moguće.

## 2.8 Poslovanje – Studio TAF

- **Prodaja Fluxe** ulazi u poslovanje **Studio TAF-a** (pravno lice, nosilac prava fakturisanja); prihod od licenci ide u prihod Studija. **Troškovi zakupa** (DigitalOcean – serveri, baze, protok) obračunavaju se iz poslovanja Studija. Pripremiti ranije (ugovori, cjenovnici, interne smjernice) da kad prva prodaja dođe sve bude usklađeno.

---

# 3. Sažetak

| Kategorija | Sada (implementirano) | Kasnije (dogovoreno) |
|------------|------------------------|----------------------|
| **Fakturisanje** | Wizard, preview, storno, brojač, ručni PFR, postavke fiskalnog uređaja | Automatski fiskalni račun (L-PFR, blok na PDF) |
| **Baza** | Operativni podaci, arhiva projekata | Čišćenje testova, go-live #5754, 001/2026, PFR od PU |
| **Jezik / tržište** | Djelimični prevodi, izbor jezika u Firma | Lokal = tržište (EU, GB, US, CH), valuta, VAT, terminologija |
| **Korisnici** | Users, Roles (priprema) | User management (uloge), Saradnik, limit saradnika |
| **Prodaja** | – | Tenant, plan (Light/Full), pretplata, admin modul (super verzija), client verzija, export prazne baze, online plaćanje (webhook) |
| **Dokumentacija** | Tehnički docs u repo | User manual, tooltip uočljiviji |
| **Poslovanje** | – | Studio TAF: prihod od licenci, troškovi DO |

---

*Ovaj dokument je kanonski spisak: šta Fluxa radi danas i šta će raditi kad na njoj završimo rad. Ažurirati ga kako se zadaci realizuju.*
