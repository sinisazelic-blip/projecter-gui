# i18n = Lokal (tržište), ne samo prevod

*Zapisano: 17.02.2026. Prema zahtjevu: engleski ne smije biti "isti app s engleskim dugmićima", nego **cijela logika i označavanje kako se koristi u EU / u svijetu**.*

---

## 1. Šta je trenutno pogrešno

| Šta imamo | Problem |
|-----------|--------|
| ~20% UI prevedeno | Dugmad, neki naslovi u `en.json` – ostalo je na srpskom. |
| ~80% ostalo na srpskom | Većina prozora, poruka, labele – i dalje hardkodirano ili samo SR. |
| Valuta | Uvijek KM/BAM. Kad korisnik stavi engleski – i dalje vidi KM. Nema EUR/USD. |
| Porez | Obračun i dalje PDV 17% (BiH). Nema EU VAT stope, reverse charge, itd. |
| Terminologija | KIF, KUF, PDV, naručilac, itd. – BiH pojmovi. U EU: **Sales Ledger**, **Purchase Ledger**, **VAT**, **Buyer**, itd. |
| Logika | Sve pravila ostala BiH. Engleski jezik **ne mijenja ponašanje** – korisnik dobija engleske dugmiće uz BiH poslovanje. |

**Zaključak:** Engleski u sadašnjem obliku "ne koristi ničemu" – treba **totalno prilagoditi logiku i označavanje** kada je izabran lokal EU / international.

---

## 2. Šta treba: lokal = tržište

**Izbor jezika u Fluxi = izbor LOKALA (tržišta), ne samo jezika prikaza.**

| Lokal | Jezik | Valuta | Porez | Terminologija | Pravila |
|-------|--------|--------|--------|----------------|--------|
| **BiH (sr)** | Srpski | KM (BAM) | PDV 17%, BiH zakon | KIF, KUF, PDV, naručilac, fiskalizacija, itd. | BiH obveze, forme, brojevi |
| **EU / International (en)** | Engleski | EUR (ili USD) | VAT – EU stope, reverse charge, export | Sales Ledger, Purchase Ledger, VAT, Buyer, itd. | EU / međunarodna pravila |

- **Svaki znak, svaki dugme, apsolutno sva logika** treba da ovisi o lokalu.
- Klijent koji koristi Fluxu na engleskom **nije BiH korisnik** – agencija ili klijent iz EU, GB, USA: nema KM, nema BAM, nema BiH PDV.
- Kasnije: lokalizacija na druga tržišta (van BiH, van EU) – svako tržište svojim pravilima i oznakama.

---

## 3. Nije "prevod" nego "označavanje kako se koristi u EU"

- **NE:** mehanički prevod dugmića i rečenica (KIF → "KIF" na engleskom).
- **DA:** u EU se koriste **Sales Ledger** (umjesto KIF), **Purchase Ledger** (umjesto KUF), VAT umjesto PDV, stope i procedure prema EU.
- Isto za sve ostale stvari: valute (EUR/USD), datume, brojeve, forme – kako se to koristi u tom tržištu.

---

## 4. Primjer mapiranja: BiH → EU / international

*(Samo ilustracija – ima ih "stotine, hiljade". Ovo je za redoslijed i smjer.)*

| BiH (sr) | EU / International (en) |
|----------|---------------------------|
| KIF | Sales Ledger (ili Invoices Out) |
| KUF | Purchase Ledger (ili Invoices In) |
| PDV | VAT |
| Naručilac | Buyer / Client |
| Fiskalizacija | (po tržištu – npr. nema u istom obliku) |
| PIB/JIB | Tax ID / VAT number |
| Poziv na broj | Reference (ili sl. prema praksi) |
| KM / BAM | EUR (ili USD) |
| 17% PDV | EU VAT stope (npr. 20%, 10%, 0% – po konfiguraciji) |
| INO klijent | EU B2B / Reverse charge / Export (VAT treatment) |
| … | … |

Lista nije zatvorena – za svaki prozor treba uraditi isti princip: **oznake i logika kako se koristi u tom lokalu**.

---

## 5. Kako raditi: jedan prozor po jedan

- **Ne** raditi "sve odjednom" – previše je ovisnosti (valuta, porez, termini, baza, API).
- **Da:** sutra i dalje **jedan prozor po jedan** pripremiti za i18n:
  1. Odabrati **jedan** prozor (npr. Dashboard, ili Finansije hub, ili lista KIF-ova).
  2. Za taj prozor definirati:
     - Koje **stringove** treba u locale fajlovima (sr + en) – uključujući **terminologiju** (npr. "KIF" vs "Sales Ledger").
     - Koja **logika** ovisi o lokalu (valuta, porez, formati) – i gdje u kodu to mijenjati.
  3. Uvesti promjene samo za taj prozor (tekst + logika).
  4. Sljedeći prozor – isto.

Tako se postepeno prelazi sa "20% prevedeno, 80% srpski, sve BiH" na **potpuno lokalno ponašanje (BiH vs EU)** prozor po prozor.

---

## 6. Šta u kodu treba kad se krene redom

- **Locale** ne samo za `t("key")` nego i za:
  - **Valuta:** default i prikaz (KM vs EUR/USD) po lokalu.
  - **Porez:** koja stopa, koji naziv (PDV vs VAT), koja pravila (BiH vs EU).
  - **Terminologija:** svi ključevi u `sr.json` / `en.json` već nose **pravu** oznaku za to tržište (npr. `dashboard.fakture` = "KIF" u sr, "Sales Ledger" u en – ne "Invoices" ako se u EU koristi Sales Ledger).
- **Konfiguracija po tržištu** (stope VAT, obavezna polja, valute) – vjerovatno posebni config ili tenant/postavke, povezani s izabranim lokalom.

---

## 7. Sljedeći korak (sutra)

1. Odlučiti **koji prvi prozor** (npr. Dashboard ili Finansije).
2. Za taj prozor napisati konkretno:
   - sve labele/dugmad koje treba u locale + **tačan termin za EU** (npr. Sales Ledger, Purchase Ledger),
   - šta u tom prozoru ovisi o valuti/porezu i kako to povezati s lokalom.
3. Implementirati samo taj jedan prozor (tekst + minimalna logika za taj ekran).
4. Zatim sljedeći prozor – isto.

Ovaj dokument služi kao referenca: **zašto** engleski sada "ne koristi", **šta** treba (lokal = tržište, ne prevod), i **kako** ići jedan po jedan.
