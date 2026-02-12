# Plan razvoja – Fluxa / Projecter

*Sačuvano: 11.02.2025*

---

## 1. Budžet – kontrola vidljivosti

**Kontekst:** Budžet iz Deala koji se prenosi na projekat ne smije biti prikazan u cjelosti radnicima.

- Prikazivati samo **procentualni dio** budžeta (ne ukupan iznos)
- Owner određuje pragove odmah pored akcionih dugmića:
  - **Normalno** (green)
  - **Pazi** (orange)
  - **Stop** (red)

*Detalji za razradu pri implementaciji.*

---

## 2. Fakture

**Od:** 3/3 preview → generisanje fakture

- **Glavno dugme** – jedan potez koji obuhvata:
  - štampa 2 primjerka
  - uskladištiti PDV kopiju na određenu lokaciju (sve fakture na jednom mjestu)
  - poslati mail
- **Pored toga** – sve opcije ponaosob (štampa, snimanje, mail)
- **Modul za prikaz** – lista svih faktura (read only)
  - za inspekciju ili kad treba vidjeti šta je negdje fakturisano
  - otvaranje kao preview, eventualno štampa

*Detalji za razradu pri implementaciji.*

---

## 3. Izvodi

- Modul za prikaz izvoda **hronološki / po broju**
- Mogućnost odabira i **štampe** ako inspekcija traži izvod

*Detalji za razradu pri implementaciji.*

---

## 4. Detalji projekta – kompleksni prozori

**Lokacija:** Unutar Detalji projekta (kao dugmići)

- **Gantt-like dijagram** – faze, zaposleni, operacije
- Faze i zaposleni koji obavljaju poslove vezane za te faze
- **%** u kojoj se operacija nalazi u fazi
- **Deadline** kad operacija mora biti gotova
- Promjene u otvorenom prozoru mogu se reflektovati na roditeljski prozor

*Detalji za razradu pri implementaciji.*

---

## 5. StrategicCore

**Naziv:** StrategicCore (brzo obračunavanje budžeta u pregovorima)

- Layout specifičnog posla – unaprijed pripremljen
- **Dugmići poredani kao šahovska tabla**
- U dnu: **iznos** + **stavke** koje su dodate
- **Dugmad:** Prihvati (save), Odbaci (Cancel), Reset (vrati na nulu)
- Kreirani budžet → prenosi se u **Deal** kao dogovoreni budžet
- Na osnovu Deala → otvara se **Projektni zadatak**

*Detalji za razradu pri implementaciji.*

---

## 6. SmartPhone layout

- **Pojednostavljena** verzija – ne sve iz Fluxa
- **StrategicCore** kao glavni alat

*Detalji za razradu pri implementaciji.*

---

## Napomene

- Prioritet za sutra: Budžet (vidljivost) + Fakture (generisanje, akcije, modul)
- Svaki korak će se detaljirati kad do njega dođemo
