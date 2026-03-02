# Predlog: Formalni (knjigovodstveni) izvještaji u Fluxi

*Datum: 11.02.2025*

---

## Cilj

Fluxa pored operativnog rada (projekti, pregovori, fakture, izvodi) treba da nudi i **formalne izvještaje** koji su korisni za knjigovođu, porez i analizu. Ovo je predlog varijanti – možemo odabrati šta uvesti prvo i šta ostaviti za kasnije.

---

## A. Izvještaji za obračun i porez

| Izvještaj | Šta sadrži | Zašto |
|-----------|------------|--------|
| **Knjiga prihoda (izlaz)** | Izdane fakture po periodu: datum, broj fakture, kupac, osnovica, PDV, ukupno. Grupiranje po mjesecu/godini. | Obaveza za knjigovodstvo; pregled prihoda za porez. |
| **Knjiga rashoda (ulaz)** | Ulazne fakture / troškovi po periodu: datum, dobavljač, osnovica, PDV, ukupno. Opciono po kategoriji. | Obračun PDV-a, troškovi za porez. |
| **Pregled PDV-a po periodu** | Izlazni PDV (naše fakture) vs ulazni PDV (ulazni računi). Obračun za mjesec/kvartal. | Potrebno za PDV prijavu. |
| **Bruto / neto prihodi po periodu** | Suma prihoda po godini/kvartalu (za porez na dobit / paušal). | Porez, planiranje. |

---

## B. Izvještaji za likvidnost i naplate

| Izvještaj | Šta sadrži | Zašto |
|-----------|------------|--------|
| **Potraživanja (starenje)** | Ko nam duguje: klijent, iznos, datum dospijeća, koliko dana kasni. Grupiranje 0–30, 31–60, 61–90, 90+ dana. | Naplate, likvidnost, „koga da naplatim prvo“. |
| **Dugovanja (obaveze)** | Kome mi dugujemo: dobavljač/talent, iznos, rok plaćanja. | Planiranje izlaza, krediti. |
| **Blagajna / gotovinski promet** | Ulozi i izdaci po danu (ako vodiš blagajnu u Fluxi). | Uskladenost gotovine. |

---

## C. Izvještaji za usklađenje i kontrolu

| Izvještaj | Šta sadrži | Zašto |
|-----------|------------|--------|
| **Pregled banke vs knjige** | Stanje po izvodima vs stanje po internoj evidenciji (naplate, plaćanja). Razlike po računu. | Kontrola da sve stoji. |
| **Lista izdatih faktura po periodu** | Sve fakture u intervalu (broj, datum, kupac, iznos, valuta, status naplate). Export za knjigovođu. | Arhiva, predaja knjigovođi. |
| **Lista ulaznih faktura (KUF)** | Ulazni računi uvezeni / evidentirani u periodu. | PDV, troškovi, arhiva. |

---

## D. Redoslijed implementacije (predlog)

1. **Prvo (najkorisnije za svakodnevnicu)**  
   - Potraživanja (starenje)  
   - Lista izdatih faktura po periodu (već imamo listu faktura, proširiti filter datumom)  

2. **Drugo (za knjigovođu / porez)**  
   - Knjiga prihoda (izlaz) – iz faktura  
   - Pregled PDV-a po periodu (ako imamo ulazne fakture u KUF)  

3. **Treće (kad bude potrebno)**  
   - Knjiga rashoda (ulaz)  
   - Dugovanja (obaveze)  
   - Banka vs knjige  

---

## Napomene

- **Izvor podataka:** fakture, projektni_troskovi, placanja, bank_tx_*, fiksni_troskovi – sve to Fluxa već koristi. Formalni izvještaji su uglavnom **filtrirani prikazi i sume** nad tim podacima.
- **Export:** Za knjigovođu bitan je Excel (ili CSV) export po periodu.
- **Period:** Od–do datum za sve formalne izvještaje; bez datuma = „sve“ (kao na Svi izvještaji).

Kad odlučiš koje od ovih želiš u Fluxi prvo, možemo ih redom uvesti u modul **Svi izvještaji** (filter po tipu + period).

---

## Status implementacije

| Izvještaj | Status | Napomena |
|-----------|--------|----------|
| Potraživanja (starenje) | ✅ Implementirano | API `/api/izvjestaji/potrazivanja`, prikaz u Svi s bucketima i tabelom |
| Lista izdatih faktura po periodu | ✅ Implementirano | API `/api/izvjestaji/fakture-period`, filter datum od–do |
| Knjiga prihoda (izlaz) | ✅ Implementirano | API `/api/izvjestaji/knjiga-prihoda` |
| Pregled PDV-a po periodu | ✅ Implementirano | API `/api/izvjestaji/pdv` (PDV ulazni kad budu ulazni računi) |
| Knjiga rashoda (ulaz) | 📋 Planirano | Izvor: KUF / ulazni računi |
| Dugovanja (obaveze) | 📋 Planirano | Izvor: projektni_troskovi + placanja |
| Banka vs knjige | ✅ Implementirano | `/finance/banka-vs-knjige` – usklađenost izvoda i interne evidencije |
