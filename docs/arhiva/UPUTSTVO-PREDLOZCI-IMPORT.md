# Uputstvo: Kako napraviti predloške za import (XLSX)

Koristimo **samo XLSX** (Excel Workbook). Ne snimaj kao CSV – XLSX ispravno čuva šđčćž i sve znakove.

---

## Opšta pravila

1. Otvori Excel (ili LibreOffice Calc).
2. **Prvi red** = zaglavlje. Nazivi kolona moraju biti **tačno** kao u tabeli ispod (jedan razmak, mala/velika slova).
3. **Drugi red** = jedan primjer (da vidiš format). Možeš ga obrisati prije importa ili ostaviti – sistem će ga uvesti ako je valjan.
4. Od trećeg reda nadalje = tvoji podaci.
5. **Snimi kao:** Excel Workbook (**.xlsx**). Ne "CSV" i ne "CSV UTF-8".

---

## 1. Predložak za Cjenovnik

**Ime fajla:** `cjenovnik.xlsx`

**Red 1 – zaglavlje (jedna riječ po ćeliji):**

| A1    | B1       | C1              | D1             | E1              | F1     |
|-------|----------|------------------|----------------|-----------------|--------|
| naziv | jedinica | cijena_default   | valuta_default | cijena_ino_eur  | active |

**Red 2 – primjer:**

| A2         | B2  | C2  | D2 | E2 | F2 |
|------------|-----|-----|-----|-----|-----|
| Sati rada  | SAT | 50  | KM  |    | 1  |

**Objašnjenje kolona:**
- **naziv** – obavezno, naziv stavke (npr. "Sati rada", "Dnevnica")
- **jedinica** – obavezno: samo jedna od riječi: KOM, SAT, MIN, PAKET, DAN, OSTALO
- **cijena_default** – obavezno, broj (npr. 50 ili 10.50)
- **valuta_default** – KM ili EUR (ako prazno, biće KM)
- **cijena_ino_eur** – broj za ino cijenu u EUR, ili prazno
- **active** – 1 = aktivno, 0 = neaktivno (ako prazno, biće 1)

---

## 2. Predložak za Klijente

**Ime fajla:** `klijenti.xlsx`

**Red 1 – zaglavlje:**

| A1              | B1           | C1          | D1     | E1   | F1     | G1                  | H1       | I1      | J1    | K1             | L1                      |
|-----------------|--------------|-------------|--------|------|--------|---------------------|----------|---------|-------|----------------|-------------------------|
| naziv_klijenta  | tip_klijenta | porezni_id  | adresa | grad | drzava | rok_placanja_dana   | napomena | aktivan | is_ino| pdv_oslobodjen | pdv_oslobodjen_napomena |

**Red 2 – primjer:**

| A2            | B2        | C2           | D2       | E2              | F2  | G2 | H2 | I2 | J2 | K2 | L2 |
|---------------|-----------|--------------|----------|-----------------|-----|-----|-----|-----|-----|-----|-----|
| TV Studio d.o.o. | direktni | 1234567890123 | Ulica 1 | 71000 Sarajevo | BiH | 30  |    | 1  | 0  | 0  |    |

**Objašnjenje:**
- **naziv_klijenta** – obavezno
- **tip_klijenta** – direktni ili agencija (ako prazno = direktni)
- **porezni_id** – PIB/JIB
- **rok_placanja_dana** – broj (npr. 30)
- **aktivan** – 1 ili 0
- **is_ino** – 1 = ino klijent, 0 = domaći
- **pdv_oslobodjen** – 1 ili 0
- **pdv_oslobodjen_napomena** – tekst ako je pdv_oslobodjen 1

---

## 3. Predložak za Dobavljače

**Ime fajla:** `dobavljaci.xlsx`

**Red 1 – zaglavlje:**

| A1    | B1    | C1           | D1          | E1   | F1             | G1     | H1    | I1      | J1       | K1      |
|-------|-------|--------------|-------------|------|----------------|--------|-------|---------|----------|---------|
| naziv | vrsta | pravno_lice  | drzava_iso2 | grad | postanski_broj | adresa | email | telefon | napomena | aktivan |

**Red 2 – primjer:**

| A2           | B2     | C2 | D2 | E2       | F2    | G2       | H2          | I2           | J2 | K2 |
|--------------|--------|-----|-----|----------|-------|----------|-------------|--------------|-----|-----|
| Dobavljač XYZ | studio | 1   | BA  | Sarajevo | 71000 | Adresa 5 | info@xyz.ba | 033 123 456  |     | 1  |

**Objašnjenje:**
- **naziv** – obavezno
- **vrsta** – studio, freelancer, servis ili ostalo
- **pravno_lice** – 1 = da, 0 = ne
- **drzava_iso2** – BA, HR, RS, itd.
- **aktivan** – 1 ili 0

---

## 4. Predložak za Talente

**Ime fajla:** `talenti.xlsx`

**Red 1 – zaglavlje:**

| A1          | B1    | C1    | D1      | E1       | F1      |
|-------------|-------|-------|---------|----------|---------|
| ime_prezime | vrsta | email | telefon | napomena | aktivan |

**Red 2 – primjer:**

| A2       | B2     | C2            | D2           | E2 | F2 |
|----------|--------|---------------|--------------|-----|-----|
| Ana Anić | spiker | ana@email.com | 061 111 222 |     | 1   |

**Objašnjenje:**
- **ime_prezime** – obavezno
- **vrsta** – spiker, glumac, pjevac, dijete, muzicar ili ostalo
- **aktivan** – 1 ili 0

---

## Gdje snimiti fajlove

Kad napraviš sva četiri fajla:

1. U projektu napravi folder: **`public/templates/import/`** (ako ne postoji).
2. Snimi u njega:
   - `cjenovnik.xlsx`
   - `klijenti.xlsx`
   - `dobavljaci.xlsx`
   - `talenti.xlsx`

Tada će biti dostupni na:
- `http://localhost:3000/templates/import/cjenovnik.xlsx`
- itd.

Kad staviš fajlove u taj folder, javi pa dodamo dugme "Preuzmi predložak" u Studio i testiramo da li sistem ispravno čita XLSX (sljedeći korak je API za import).

---

## Važno

- **Nikad ne snimaj kao CSV** za ove predloške – samo .xlsx.
- **Zaglavlje** mora biti u **prvom redu** i nazivi kolona **tačno** kao gore (bez dodatnih razmaka).
- Prazna polja ostaju prazna; sistem će uzeti default vrijednosti gdje je navedeno.
