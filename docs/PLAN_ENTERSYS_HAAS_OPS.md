# Plan razvoja: EnterSYS HaaS & Ops radni prostor (Vlasnički nadzor nove firme)

Ovaj dokument definiše tačnu arhitekturu i prikaz za radni prostor **EnterSYS HaaS & Ops** kada se registruje novo pravno lice sa svojim direktorom i radnicima, dok vlasnik (osnivač) zadržava strateški i finansijski nadzor bez svakodnevnog operativnog mikromenadžmenta.

---

## 1. Cilj i organizaciona uloga

- **Operativni tim (Direktor + Radnici):** vodi nabavku komponenti, magacine, kompletaciju uređaja po sastavnicama, servis u radionici, montažu na terenu i SLA zamjene.
- **Vlasnik (Owner Oversight Mode):** jednim pogledom vidi zdravlje firme — koliko opreme je u najmu (HaaS MRR), koliko opreme stoji na stanju u magacinu (zarobljeni kapital), koji radni nalozi kasne, kakvi su troškovi servisa i kolika je profitabilnost svakog ugovora.

---

## 2. Arhitektura prikaza (Dashboard & Sidebar za EnterSYS Ops)

Kada se u gornjem meniju odabere **EnterSYS HaaS & Ops**, aplikacija treba da zamijeni Studio TAF sekcije sa specijalizovanim Ops prikazom:

### A. Centralni Vlasnički Pult (Ops Display)
1. **HaaS Prihod & Ugovori (MRR):**
   - Ukupan mjesečni prihod od najma hardvera + softvera po aktivnim objektima.
   - Broj instaliranih uređaja na terenu (tripodi, touch kase, pametni ormarići, čitači, kontroleri).
2. **Proizvodnja & Kompletacija (Radni nalozi):**
   - Aktivni nalozi za sklapanje uređaja (status: *Čeka komponente → U sklapanju → Testirano → Spremno za teren*).
   - Upozorenja za kašnjenje rokova isporuke ili manjak dijelova po sastavnicama (`BOM`).
3. **Magacin & Zarobljeni Kapital:**
   - Vrijednost zaliha u magacinu (komponente + gotovi sklopovi).
   - Minimalne zalihe (alarm kada ključne komponente padnu ispod praga).
4. **Radionica & SLA Servisi:**
   - Otvoreni servisni tiketi sa terena, prosječno vrijeme odziva / zamjene uređaja i trošak rezervnih dijelova po klijentu.

### B. Namjenski Bočni Meni (`OpsSidebar`)
Umjesto audio/agencijskih stavki, bočni meni u ovom radnom prostoru prikazuje:
- **Glavni Ops Desk:** Pregled vlasnika, Kalendar montaža i servisa, Aktivni HaaS ugovori
- **Proizvodnja & Magacin:** Artikli & Komponente, Sastavnice (`BOM`), Kompletacija uređaja, Prijemnice & Nabavka
- **Teren & Servis:** Radni nalozi (`RN`), Radionica (servisi), QR evidencija opreme (serijski brojevi)
- **Finansije & Izvještaji:** HaaS fakturisanje, Troškovi materijala vs. najam, Izvještaj rada direktora i ekipe

---

## 3. Vlasničke kontrole i prava pristupa (Direktor vs. Vlasnik)

- **Direktor / Voditelj Ops-a:** upravlja radnim nalozima, magacinom, nabavkama i rasporedom radnika; nema pristup brisanju istorijskih finansijskih tragova niti promjeni vlasničkih parametara.
- **Radnici (Tehničari / Skladištari):** vide isključivo svoje radne naloge, skeniranje serijskih brojeva (`QR`), kompletaciju i servisne tikete.
- **Vlasnik:** Read-only + Override uvid u sve tokove, audit log svake izmjene stanja magacina/opreme, odobravanje većih nabavki i pregled neto dobiti po ugovoru.

---

## 4. Redoslijed implementacije (kada novo pravno lice bude spremno)

1. **Razdvajanje uloga i radnog prostora:** povezati `WorkspaceSwitcher` tako da izbor `EnterSYS HaaS & Ops` automatski učitava `OpsSidebar` i `OpsDashboard`.
2. **Integracija postojećih `/ops/*` ruta:** povezati postojeće module (`magacini`, `sastavnice`, `kompletacija`, `radionica`, `nalozi`, `haas`, `qr`) u jedinstven tok od prijemnice → sklapanja → izdavanja na teren → HaaS fakturisanja.
3. **Vlasnički KPI izvještaj (Owner Digest):** sedmični/mjesečni sažetak za vlasnika (novi ugovori, sklopljeni uređaji, servisi, trošak materijala, neto HaaS prihod).
