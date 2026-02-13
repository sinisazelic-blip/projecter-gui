# Plan: Izvještaji – talenti, dobavljači, klijenti, banka, fakture

*Datum: 11.02.2025*

---

## Kontekst

- Trenutno: Excel, ručno, dugo traje, rijetko se ponovo koristi
- Knjigovođa: samo formalno/pridržavanje zakona, ne daje poslovne informacije
- Cilj: sam sebi dati uvid bez gubitka vremena, fokus na studio

---

## 1. Izvještaji po talentima

| Izvještaj | Šta pokazuje | Izvor podataka |
|-----------|--------------|----------------|
| **Talent – ukupno** | Za nas je radio X projekata, zaradio ukupno Y KM (EUR) | projektni_troskovi (talent_id), projekti |
| **Talent – stanje** | BB poslova u toku ili čeka plaćanje, dug prema njemu | projektni_troskovi (status), placanja_stavke |
| **Talent – po periodu** | Koliko je naplatio u januar 2025, u Q1 itd. | datum_troska, datum_placanja, linkovi |

**Potrebno:** Agregacija po talent_id, grupa po godini/mjesecu, sumiranje po statusu (plaćeno/čekaj).

---

## 2. Izvještaji po dobavljačima

| Izvještaj | Šta pokazuje | Izvor |
|-----------|--------------|-------|
| **Dobavljač – ukupno** | Za nas je radio X projekata, naplatio ukupno Y KM | projektni_troskovi (dobavljac_id) |
| **Dobavljač – stanje** | Neplaćeno, u toku | projektni_troskovi + placanja |
| **Dobavljač – po periodu** | Po mjesecu/godini | datum_troska, datum_placanja |

Slično kao talenti, samo drugi entitet.

---

## 3. Izvještaji po naručiocima (klijentima)

| Izvještaj | Šta pokazuje | Izvor |
|-----------|--------------|-------|
| **Klijent – projekti** | Koliko je projekata, ukupna vrijednost | projekti (narucilac_id / krajnji_klijent_id) |
| **Klijent – naplate** | Šta je naplaćeno, kada | fakture, uplate |
| **Klijent – potraživanja** | Šta duguje | projekt_potrazivanja ili slično |

---

## 4. Banka – „koliko me košta banka”

| Šta mjeriti | Izvor | Napomena |
|-------------|-------|----------|
| Provizije | bank_tx_posting (kategorija / opis) | Iz XML v2 – amount < 0, opis sadrži „provizija” |
| Mjesečno održavanje | bank_tx_posting | Periodične transakcije |
| FI na transakcije | bank_tx_posting | Po opisu |
| SWIFT | bank_tx_posting | SWIFT u opisu |

**Predlog:** Označiti transakcije kao „bank_fee” (tip/kategorija) – ručno ili pravilo – pa filtrirati i sumirati po periodu.

**Format izvještaja:** Mjesec | Provizije | Održavanje | FI | SWIFT | Ukupno.

---

## 5. Fakturna vrijednost i naplate po periodu

| Izvještaj | Šta | Izvor |
|-----------|-----|-------|
| Fakturirano u periodu | Suma izdatih faktura (datum_izdavanja u range) | fakture |
| Naplaćeno u periodu | Suma uplata (datum_uplate u range) | uplate / bank_tx_posting |
| Ostalo na naplatu | Fakturirano − naplaćeno | Iz prethodnih |

---

## 6. Fiksni troškovi vs prihod vs ukupni troškovi

| Izvještaj | Šta | Izvor |
|-----------|-----|-------|
| Fiksni troškovi (period) | Mjesečni/godišnji iznos | fiksni_troskovi (raspored) |
| Prihod (period) | projektni_prihodi, fakture | |
| Ukupni troškovi (period) | projektni_troskovi | |
| Poređenje | Fiksni % od prihoda, trend | Izračun |

---

## 7. Predloženi pristup – modularni izvještaji

### 7.1 Šablon izvještaja

Svaki izvještaj ima:
- **Filter:** Period (od–do), opciono entitet (talent_id, dobavljac_id, klijent_id)
- **Metrika:** Šta računamo (suma, broj, prosjek)
- **Grupiranje:** Po mjesecu, godini, entitetu
- **Izlaz:** Tabela + opciono Excel export

### 7.2 Implementacija

1. **Ruta:** `/izvjestaji` ili `/studio/izvjestaji` – lista dostupnih izvještaja
2. **Svaki izvještaj:** posebna stranica npr. `/izvjestaji/talenti`, `/izvjestaji/dobavljaci`…
3. **API:** `/api/izvjestaji/talenti`, `/api/izvjestaji/dobavljaci`… – parametri: date_from, date_to, group_by
4. **Stranica:** forma (filter period, entitet) + tabela + opciono dugme „Export Excel”

### 7.3 Redoslijed

| Prioritet | Izvještaj | Zašto |
|-----------|-----------|-------|
| 1 | Talenti – ukupno, stanje | Često potrebno |
| 2 | Dobavljači – isto | Često potrebno |
| 3 | Klijenti – projekti, naplate | Važno za odnose |
| 4 | Banka – troškovi | Sada lako uz XML v2 |
| 5 | Fakturirano / naplaćeno po periodu | Pregled |
| 6 | Fiksni vs prihod | Upravljanje |

---

## 8. Tehničke napomene

- **Excel export:** `xlsx` ili `exceljs` biblioteka
- **Period picker:** HTML5 date input (od–do)
- **Caching:** Za teške upite – opciono cache 5–15 min
- **PDF:** Kasnije, ako zatreba (npr. jspdf)

---

## 9. Šta imaš u bazi (pregled)

| Entitet | Tabela | Ključna polja |
|---------|--------|---------------|
| Talenti | talenti, projektni_troskovi | talent_id |
| Dobavljači | dobavljaci, projektni_troskovi | dobavljac_id |
| Klijenti | klijenti, projekti | narucilac_id, krajnji_klijent_id |
| Banka | bank_tx_posting, bank_tx_staging | amount, value_date, description |
| Fakture | fakture | datum_izdavanja |
| Fiksni | fiksni_troskovi | datum_dospijeca, iznos |
| Troškovi | projektni_troskovi | datum_troska, iznos_km |
| Prihodi | projektni_prihodi | datum_prihoda, iznos_km |

---

## 10. Sljedeći korak

Kad budeš spreman: prvo jedan jednostavan izvještaj (npr. „Talenti – ukupno i po projektu”) kao prototip, pa ostalo po prioritetu.

**Napomena:** Sutra u studiju, prije kolegija – napraviti bar nešto od ovoga.

---

## 11. Formalni (knjigovodstveni) izvještaji

Uobičajeni knjigovodstveni izvještaji koje Fluxa može nuditi (knjiga prihoda, rashoda, PDV, potraživanja, dugovanja, banka vs knjige itd.) – **predlog varijanti i redoslijed:** `docs/PLAN_IZVJESTAJI_FORMALNI.md`.
