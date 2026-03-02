# Fluxa – roadmap nastavak i kontinuirano

*Zapisano: 17.02.2026*

Ovaj dokument sadrži **tačne korake** do go-live-a, zatim dokumentaciju i kontinuirane obaveze.

---

## Završeno (pre ovog plana)

- PDV prijava stranica (obračun za period, KIF/KUF liste, iznos za prijavu)
- Format datuma dd.mm.yyyy na PDV prijavi i Banka vs knjige

---

## Koraci do go-live (redom)

### 1. Automatika fiskalizacije

- Implementacija fiskalnog računa po planu
- (Dokumentacija / napomene: `docs/FLUXA-V1-FISKAL-NAPOMENE.md`, `docs/fiskal/`)

### 2. User management sistem

- Implementacija prema planu i provjerenoj dokumentaciji
- (Priprema: `docs/UPUTSTVO-PRIPREMA-USER-MANAGEMENT.md`, `docs/PLAN_AUTH_ROLES.md`)

### 3. Čišćenje test podataka (od 1.1.2026)

- **Pristup:** otvarati **jednu po jednu tabelu**, korisnik odlučuje: ovo briši / ovo nemoj
- **Brisati:** sve testiranje sa datumima od **1.1.2026** pa nadalje (projekti, fakture, ponude, izvodi itd.)
- **Ne dirati:** arhiva – sve do **31.12.2025** ostaje (projekti, troškovi, talenti, dobavljači)
- Backup baze prije brisanja

### 4. Upload Fluxa na hosting

- Deploy na hosting za početak rada (go-live)
- (Vidi i: `docs/PLAN_DEPLOY_I_INSTALACIJA.md` ako postoji)

---

## Nakon upload-a (go-live)

### 5. Dokumentacija Fluxe – uputstvo upotrebe

- Objasniti **logiku** koja je u Fluxi posložena
- Objasniti **dugmiće i funkcije**
- Sadržaj će se sakupiti na jedno mjesto, zatim izdizajnirati **pravi manual** za druge korisnike (upoznavanje sa Fluxom)

---

## Kontinuirano (nakon go-live)

### Implementacija Fluxe svakom novom klijentu

- Radi **ti + ja** (Studio TAF + AI partner)
- Klijent daje samo **ulazne parametre**
- Svaki klijent = posebna implementacija / konfiguracija

### Održavanje

- Radi **ti + ja**
- Za **Studio TAF**, ali i za **ostale klijente** koji koriste Fluxu

---

## Brzi pregled

| # | Korak | Status |
|---|--------|--------|
| 1 | Automatika fiskalizacije | Sljedeći |
| 2 | User management | Na redu |
| 3 | Čišćenje test podataka (od 1.1.2026, tabela po tabela) | Nakon toga |
| 4 | Upload na hosting | Go-live |
| 5 | Dokumentacija / manual za korisnike | Nakon upload-a |
| — | Implementacija po klijentu (ti + ja) | Kontinuirano |
| — | Održavanje (Studio TAF + ostali klijenti) | Kontinuirano |
