# Lista do go-live – Fluxa

*Sastavljeno: 23.02.2026. Jedan dokument sa redoslijedom rada do dizanja Fluxe na hosting.*

---

## Redoslijed (kako idemo)

1. **Fiskalizacija** – automatski fiskalni račun u fakture  
2. **Prevod na engleski** – i18n, lokal = tržište (EU VAT, terminologija, dugmad, tooltipovi)  
3. **Čišćenje baze** – ukloniti test podatke, ostaviti arhivu do 31.12.2025  
4. **Ostalo** – export prazne baze, tooltip, dokumentacija, tenant/admin, Saradnik, poslovanje  
5. **Na kraju** – dizanje Fluxe na hosting (kad sve bude gotovo)

---

# 1. Fiskalizacija

- **Cilj:** Fiskalni uređaj (L-PFR API) povezan s Fluxom; u wizardu izbor „DA” za automatsku fiskalizaciju → poziv uređaju, odgovor (QR, PFR broj, vrijeme, brojač) u fakturu i **fiskalni blok** na PDF-u.
- **Detalji:** `docs/FLUXA-V1-FISKAL-NAPOMENE.md` (poglavlja 2 i dalje).
- **Implementacija:** Postavke iz `firma_fiskal_settings` (Base URL, EsirKey, PIN). Wizard korak 2/3: automatska fiskalizacija → poziv API-ja; u fakturu upisati PFR i ostale elemente; na PDF-u ispod stavki blok „FISKALNI RAČUN” (QR, PFR vrijeme, PFR broj, brojač, KRAJ FISKALNOG RAČUNA). Ručno = nema bloka, PFR ostaje u headeru. PFR broj za sljedeću fakturu = ono što PU vrati (n+1).

---

# 2. Prevod na engleski (i18n)

- **Cilj:** Ne goli prevod – **lokal = tržište**: engleski u duhu jezika, EU (EUR, VAT, Sales Ledger, Purchase Ledger), podrška i18n standarda (jezik, dugmad, tooltipovi, VAT sistem EU).
- **Detalji:** `docs/I18N_LOKAL_KAO_TRZISTE.md`, `docs/PLAN_JEZICI_I_PRETPLATA.md`.
- **Implementacija:** Jedan prozor po jedan – stringovi u locale fajlovima (sr + en, terminologija za tržište) + logika (valuta, porez, formati) ovisna o lokalu. Konfiguracija po regionu (stope VAT, valute, obavezna polja). Ne samo zamjena teksta, nego prilagodba ponašanja.
- **Status (23.02.2026):** Prilagodba/prevod UI stringova na i18n (sr + en) **završen** za sve Studio stranice i šifarnike. Sljedeći korak: pregled i popravke; zatim dalje po redu (lokal = tržište, valuta/VAT po potrebi).

---

# 3. Čišćenje baze

- **Cilj:** Ukloniti sve test podatke (projekti, dialovi, ponude, izvodi, itd.). Ostaviti **samo arhivu** do 31.12.2025.
- **Provjera:** Posljednji arhivirani projekat – pretpostavlja se **#5753** (provjeriti u bazi).
- **Poslije čišćenja:** Prvi sljedeći projekat **#5754**, prva faktura **001/2026**, PFR **51** (ili onaj koji PU RS vrati pri prvoj automatskoj fiskalizaciji).
- **Implementacija:** Backup baze; skripta ili ručno brisanje test podataka; zadržati projekte arhivirane do 31.12.2025. Brojač faktura i PFR postaviti u skladu s gore navedenim.

---

# 4. Ostalo (prije hostinga)

| # | Zadatak | Kratki opis |
|---|---------|-------------|
| 4.1 | **Export prazne SQL baze** | Schema-only (bez podataka) za novi tenant – npr. `scripts/schema-empty.sql`. Verzionirati; ažurirati pri novim migracijama. V. `PLAN_AKTIVNOSTI_NAREDNI_PERIOD.md` 2.7. |
| 4.2 | **Tooltip** | Uočljiviji tooltipovi na dugmićima (font, kontrast), konzistentna komponenta; opciono i18n za tekstove. V. plan 2.6. |
| 4.3 | **Dokumentacija / User manual** | Kako koristiti Fluxu po modulima, korak-po-korak, screenshoti. V. plan 2.5. |
| 4.4 | **Tenant + plan + subscription** | Tabele `tenants`, `plans`; provjera pri loginu (subscription_ends_at); limit korisnika. V. plan sekcija 1.2. |
| 4.5 | **Admin modul (licence/organizacije)** | Samo vaša instanca – lista tenanata, produženje, promjena plana; na klijentskim deploy-ima `ENABLE_TENANT_ADMIN=false`. V. plan 1.2. |
| 4.6 | **User management + Saradnik** | Uloga Saradnik (samo dodijeljeni projekti), limit saradnika po tenantu. V. `UPUTSTVO-PRIPREMA-USER-MANAGEMENT.md`, plan 2.4. |
| 4.7 | **Poslovanje Studio TAF** | Pravno/računovodstveno: prihod od licenci, troškovi DO; ugovori, cjenovnici. Nije u kodu, dio pripreme. V. plan 2.8. |

Redoslijed unutar „ostalo” može se prilagoditi; navedeni brojevi su samo spisak.

---

# 5. Na kraju – dizanje Fluxe na hosting

- **Kad:** Kad su koraci 1–4 završeni (fiskalizacija, i18n, čišćenje baze, ostalo po potrebi).
- **Šta:** Deploy na DO host – upload koda, `npm ci` / `npm run build`, `.env` za produkciju, baza (MySQL/MariaDB), PM2 ili systemd, nginx (reverse proxy, HTTPS).
- **Detalji:** `docs/PLAN_DEPLOY_I_INSTALACIJA.md` (koraci 1.1–1.3, varijable okruženja, web server).

---

## Reference

- **PLAN_AKTIVNOSTI_NAREDNI_PERIOD.md** – puni opis svih zadataka i referenca na druge planove  
- **FLUXA-V1-FISKAL-NAPOMENE.md** – fiskalni uređaj, wizard, PDF blok  
- **I18N_LOKAL_KAO_TRZISTE.md** – zašto lokal = tržište, kako raditi prozor po prozor  
- **PLAN_DEPLOY_I_INSTALACIJA.md** – hosting, instalaciona verzija, šta klijent dobija  

*Ažurirati ovaj dokument kako se zadaci realizuju.*
