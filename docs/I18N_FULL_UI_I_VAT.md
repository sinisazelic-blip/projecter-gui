# i18n: cijeli interfejs na engleskom + VAT (EU) u EN verziji

*Zapisano: prema ranijem zahtjevu. **Ažurirano:** trenutna implementacija (samo zamjena stringova, bez promjene valute/poreza/terminologije) je **pogrešan smjer**. Vidi **[I18N_LOKAL_KAO_TRZISTE.md](./I18N_LOKAL_KAO_TRZISTE.md)** – lokal = tržište (BiH vs EU), ne samo prevod; rad prozor po prozor.*

---

## Zahtjev (originalni)

1. **Svi prozori, sva dugmad** – cijeli interfejs u internacionalnom engleskom jeziku kada je izabran engleski. Nije "samo jedna stranica", već **sve** u duhu engleskog jezika, do detalja.

2. **Nije "prevod"** – interfejs treba biti prirodan engleski (terminologija, fraze), ne mehanički prevod.

3. **Faktura i ponuda/predračun (EN verzija)**  
   - Ne obračunava se **PDV** nego **VAT** sa EU zakonom (procedure, procenti).  
   - U srpskoj verziji ostaje PDV i lokalna logika.

4. **INO klijent u engleskoj verziji**  
   - **Nema** INO klijenta u smislu promjene valute ili jezika – interfejs je uvijek engleski.  
   - **INO klijent** u EN verziji jedino ima smisla za **obračun VAT-a** (npr. EU B2B, reverse charge, export).  
   - Dakle: u EN, oznaka/checkbox treba biti u duhu "VAT treatment" (Domestic / EU B2B / Export), ne "INO za valutu/jezik".

---

## Implementacija

- **Jezik interfejsa:** `sr` (srpski) i `en` (engleski). Izbor u Studio → Firma (dropdown). Preferenca u cookie `NEXT_LOCALE`.
- **Prevodi:** `locales/sr.json` i `locales/en.json` – svi UI stringovi (navigacija, dugmad, labele, poruke). Server komponente koriste `getT(locale)` iz cookie-a; client komponente `useTranslation().t`.
- **VAT vs PDV:** U komponentama fakture i ponude: ako `locale === 'en'`, prikazati "VAT", stope i procedure prema EU; ako `locale === 'sr'`, "PDV" i lokalna pravila.
- **INO u EN:** U šifarniku klijenata (i gdje god se koristi) za `en`: zamjena koncepta "INO klijent (valuta/jezik)" oznakom vezanom za **VAT treatment** (npr. "VAT: EU B2B / Reverse charge / Domestic").

---

## Status

- [x] Plan i server-side `getT(locale)` (lib/translations.js); layout čita cookie i postavlja `html lang` i `data-locale`.
- [x] Prošireni `sr.json` i `en.json`: common, nav, dashboard, finance, firma, vat (PDV/VAT, INO vs VAT treatment).
- [x] Dashboard: sve labele i dugmad preko `t()` (async page + cookie).
- [x] Finansije (hub): naslov, kartice, Otvori, Napomena preko `t()`.
- [x] Studio/Firma: FirmaHeader + LanguageSwitcher; naslov i podnaslov preko `t()`.
- [x] Klijenti: u EN verziji „INO klijent” → „VAT treatment” (checkbox + hint); badge „BiH”/„INO” → „Domestic”/„EU B2B / Reverse charge”; PDV oslobođen → „VAT exempt” + prevodi napomene.
- [ ] Ostale stranice (Fakture, Ponude, Banka, KUF, izvještaji, itd.): postupno prebaciti na `t()` i dodati ključeve.
- [ ] Faktura i Ponuda (wizard/preview): prikaz i obračun VAT (EN) vs PDV (SR); EU stope i procedure u EN.

---

## Napomena (17.02.2026)

Gore navedeni status odnosi se na **zamjenu UI stringova** (dugmad, labele) preko `t()`. To **nije dovoljno**: kada je izabran engleski, i dalje su valuta KM, porez PDV 17%, termini KIF/KUF – tj. cijela logika ostaje BiH. Pravilan pristup: **lokal = tržište** (BiH vs EU/international), sa prilagodnom valutom (EUR/USD), VAT pravilima i terminologijom (npr. Sales Ledger, Purchase Ledger). Rad **jedan prozor po jedan**. Detalji u [I18N_LOKAL_KAO_TRZISTE.md](./I18N_LOKAL_KAO_TRZISTE.md).
