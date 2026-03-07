# Fluxa v1.0 – Fiskalni sistem: urađeno, ostalo, naputke

Dokument nastao nakon rada na postavkama fiskalnog uređaja i brojaču faktura. Služi kao referenca za implementaciju automatskog fiskalnog sistema i za buduće dorade.

---

## 1. Šta je urađeno (stanje prije automatskog fiskalnog sistema)

### 1.1 Postavke fiskalnog uređaja (po firmi)

- **Lokacija:** Studio → Firma → dugme **„Postavke fiskalnog uređaja”** (otvara modal).
- **Baza:** Tabela `firma_fiskal_settings` (jedan red po `firma_id`). Skripta: `scripts/firma-fiskal-settings.sql`.
- **Polja u modalu:**
  - Base URL uređaja (obavezno za slanje; npr. `http://192.168.x.x:3566/`)
  - API ključ (EsirKey) – obavezan za komunikaciju sa BE
  - PIN – za komunikaciju sa samim uređajem; prazno = ručni unos na uređaju
  - Koristi eksterni štampač (checkbox) + naziv štampača + širina (znakova) – za naš slučaj ne koristimo (eksterni štampač = POS u kafićima; mi uvijek faktura + fiskalni odgovor na fakturi)
- **API:** GET i POST `/api/firma/fiskal` (čitaju/pišu za aktivnu firmu).

### 1.2 Brojač faktura (početna vrijednost prije Fluxe)

- **Lokacija:** Studio → Firma, sekcija **„Brojač faktura”** ispod dugmeta za fiskalni uređaj.
- **Svrha:** Jednom po godini postavi se „posljednji izdati broj fakture prije korištenja Fluxe” (npr. 42 za 2026). Od tog trenutka Fluxa dodeljuje 043/2026, 044/2026, …
- **Baza:** Tabela `brojac_faktura` (godina, zadnji_broj_u_godini). Koristi se u `fakture` create i storno.
- **Logika:** Sljedeći broj = **max(** MAX(broj_u_godini) iz `fakture` za tu godinu, zadnji_broj_u_godini iz `brojac_faktura` za tu godinu **) + 1**.
- **API:** GET i POST `/api/firma/brojac-faktura`.

### 1.3 PFR broj (fiskalni)

- **Wizard korak 2/3:** Polje **„PFR broj (opciono)”** ostaje. Služi za ručni unos kada nema automatskog uređaja (npr. na putu, faktura u Fluxi, fiskalni račun ručno izdaje neko u studiju i šalje klijentu sastavljenu fakturu + fiskalni račun).
- **PFR nema reset po godini** – brojevi idu 55, 56, 57, … kontinuirano. Broj fakture (011/2026) resetuje se sa novom kalendarskom godinom; PFR ne.
- **PU u odgovoru šalje n+1** (n = posljednji izdati fiskalni račun). Kad implementiramo automatski sistem, Fluxa treba da snimi taj broj kao „zadnji PFR” i za sljedeću (ručnu ili automatsku) koristi n+1.

---

## 2. Šta ostaje za sutra (implementacija automatskog fiskalnog sistema)

1. **Povezati fiskalni uređaj sa Fluxom**
   - Koristiti postavke iz `firma_fiskal_settings` (Base URL, EsirKey, PIN).
   - Prema tehničkoj dokumentaciji (L-PFR API): Base URL + endpointi (npr. POST za račun, GET status, PIN ako treba).

2. **Wizard fakture, korak 2/3**
   - Kad korisnik izabere **DA** za automatsku fiskalizaciju: pozvati uređaj, dobiti odgovor (QR, PFR broj, PFR vrijeme, brojač računa), snimiti u fakturu i prikazati fiskalni blok na PDF-u.
   - Kad je **NE** (ručno): kao dosad – polje za ručni PFR ostaje, nema poziva prema uređaju.

3. **Fiskalni blok na Fluxa fakturi (PDF)**
   - **Pozicija:** Ispod tabele stavki, lijevo od bloka „Osnovica / PDV / Ukupno” (korisnik je označio crvenim na preview-u).
   - **Sadržaj bloka (kad postoji automatski odgovor):**
     - Naslov: **FISKALNI RAČUN**
     - QR kod (PU „zaštitni znak”, za provjeru valjanosti)
     - PFR vrijeme (datum/vrijeme fiskalizacije)
     - PFR broj računa (npr. V7DSSK8Y-V7DSSK8Y-81404)
     - Brojač računa (npr. 69693/81404ПП)
     - Završni natpis: **KRAJ FISKALNOG RAČUNA**
   - **Kad nema fiskalizacije (ručno):** Faktura izgleda isto, samo **nema** fiskalnog bloka.

4. **PFR broj u headeru fakture**
   - U gornjem desnom bloku (Broj računa, Datum, PFR broj, …): **ne prikazivati** PFR broj na tom mjestu kad postoji fiskalni blok (da ne duplamo – PFR je već u fiskalnom bloku).
   - Kad je ručna fiskalizacija (nema bloka), PFR ostaje u headeru kao sada.

5. **Ažuriranje „zadnjeg PFR” nakon automatske fiskalizacije**
   - Kad PU vrati PFR broj (n+1), Fluxa ga snimi kao zadnji korišteni PFR da bi sljedeća faktura (ručna ili automatska) koristila n+1. Nema godišnjeg resetovanja za PFR.

6. **Storno**
   - Kad se radi storno sa automatskim sistemom, PU šalje svoj broj (n+1) za storno; pri sljedećem fakturisanju opet n+1. Ručni PFR u wizardu i dalje ima smisla za scenarije bez uređaja.

---

## 3. Naputke iz tehničke dokumentacije (L-PFR / Esir)

- **Tačan API spec:** U `docs/fiskal/` nalaze se PDF dokumenti (npr. **Техничка-документација.pdf**, Тестирање.pdf) – tamo je definisano tačno šta uređaj očekuje u body-ju (nazivi polja, obavezna polja, formati). Kad dobiješ 400 bez detalja, treba iz tog PDF-a provjeriti format zahtjeva.
- **Komunikacija:** HTTP na Base URL (WiFi/LAN). Za aplikaciju isto.
- **Endpointi (iz konteksta):** npr. `POST /api/v3/invoices` (JSON: stavke, plaćanje, tip računa, …), `GET /api/v3/status`, `POST /api/v3/pin` ako treba.
- **PaymentType (referenca):** Other=0, Cash=1, Card=2, Check=3, WireTransfer=4, Voucher=5, MobileMoney=6.
- **Config polja (referentni nazivi):** EsirBase (Base URL), EsirKey (API ključ), EsirExt / EsirExtStampac / EsirExtSirina (eksterni štampač – mi ne koristimo).
- **Ručni unos na PU (referenca):** Pri ručnom izdavanju računa na uređaju unosi se: ukupan iznos (sa PDV-om), broj komada, stopa (BH kupac = E / 17%, INO kupac = N / 0%), naziv kupca; u dodatna polja PIB ili JIB (ovisno da li je kupac PDV obveznik ili ne), a za INO kupca umjesto PIB unosi se 13 devetki (9999999999999). Zatim „Štampaj račun”. To sugerira da API možda očekuje i podatke o kupcu (naziv + identifikator).
- **Testiranje:** Sutra s fiskalnim uređajem – učitati tačan format odgovora (QR, JIR, PFR broj, brojač) i uskladiti nazive polja u kodu.

### 3.1 Sistem PU za provjeru fiskalnih računa (testiranje / inspekcija)

Kad komunikacija sa fiskalnim uređajem prođe, račun se može provjeriti putem **SUF sistema za provjeru fiskalnih računa** (Poreska uprava BiH). Sistem vraća jednu od tri poruke:

- **Račun je valjan**
- **„Ovo nije fiskalni”** – dokument koji se provjerava ne zadovoljava kriterije fiskalnog računa (nije pravilno fiskaliziran kroz SUF ili nema podatke za validaciju)
- **Servis nije dostupan**

Provjera je moguća: putem linka za verifikaciju na računu, skeniranjem QR koda sa računa, ili unosom podataka (npr. bez QR-a). Prijava nefiskalnih / sumnjivih računa: [suf.poreskaupravars.org/verify](https://suf.poreskaupravars.org/verify/), za neizdane račune (bez PFR): [suf.poreskaupravars.org/CustomerReport/Complain](https://suf.poreskaupravars.org/CustomerReport/Complain). Izvor: dokumentacija PU / članak „Kupci mogu provjeriti fiskalne račune”, Banjaluka.net.

### 3.2 Referenca: izgled fiskalnog bloka (Aero Centar Krila, januar 2026)

Primjer fakture: **`docs/fiskal/AeroKrila faktura za januar 2026.pdf`**. Aero Krila naplaćuje korištenje i održavanje fiskalnog uređaja i u direktnoj je vezi sa PU – njihov izgled računa uzima se kao referenca za zakonski ispravan fiskalni blok.

**Redoslijed elemenata u fiskalnom bloku (od vrha prema dnu):**

1. **FISKALNI RAČUN** (naslov bloka)
2. JIB izdavaoca (npr. 4401686560006)
3. Naziv izdavaoca (npr. AERO CENTAR KRILA d.o.o. Banja Luka)
4. Jedinstveni ID / oznaka (npr. 10024401686560001-AERO CENTAR KRILA d.o.o. Banja Luka)
5. Adresa izdavaoca (Ulica, grad)
6. **Kasir:** (vrijednost)
7. **ID kupca:** (JIB/PIB kupca, npr. 4509750610000)
8. **Esir broj:** (npr. 77/4.0 – verzija/firmware)
9. **ПРОМЕТ ПРОДАЈА** (Promet prodaja)
10. Tabela artikala: Šifra | Назив | Цијена | Количина | Укупно (stavke sa oznakom E/N za PDV)
11. Porez po stopi: npr. E, ПДВ 17%, iznos poreza, promet
12. **Укупан износ:** (ukupno sa PDV-om)
13. **Пренос на рачун:** / način plaćanja (iznos)
14. **Примљено средстава:** (iznos)
15. **Разлика за поврат:** (0,00)
16. Dvokolonski red: **ПФР вријеме:** dd.mm.yyyy HH:mm:ss | **Укупан износ без пореза:** (osnovica)
17. **ПФР бр.рач:** (npr. V7DSSK8Y-V7DSSK8Y-81404) | **Укупан износ пореза:** (PDV)
18. **Бројач рачуна:** (npr. 69693/81404ПП)
19. **КРАЈ ФИСКАЛНОГ РАЧУНА**

Mapiranje na odgovor uređaja (L-PFR API): `sdcDateTime` → PFR vrijeme; `invoiceNumber` ili sl. → PFR br.rač; `invoiceCounter` / `totalCounter` → Brojaч рачуна; `verificationQrCode` → QR za provjeru. Kasir i ID kupca šaljemo u zahtjevu; ukupan iznos bez/sa porezom imamo iz stavki fakture.

---

## 4. Naputke iz dogovora (večeras)

- Fiskalne postavke su **po firmi** (multi-tenant: svaka firma svoj uređaj).
- Faktura ostaje u **Fluxa stilu**, fiskalni blok je **dodatak** kad postoji.
- **Eksterni fiskalni štampač** = POS u maloprodaji/kafu; mi ga ne koristimo – uvijek faktura + odgovor PU (QR, itd.) na našoj fakturi.
- **Referenca za izgled fiskalnog bloka:** AC Krila (povezani sa PU RS) – na njihovom računu: FISKALNI RAČUN, QR, kasir, ID kupca, Esir broj, PFR vrijeme, PFR br.rač, brojač, KRAJ FISKALNOG RAČUNA. Mi možemo blok urediti vizuelno, ali obavezne elemente držati.
- **Broj fakture:** Početna vrijednost samo jednom u **Studio → Firma** (Brojač faktura). U wizardu korak 2/3 **nema** polja za broj fakture.
- **PFR ručni upis** u wizardu ostaje zbog hibridnog scenarija (na putu, bez uređaja, neko u studiju ručno izdaje fiskalni račun i šalje sastavljenu fakturu + fiskalni račun klijentu).

---

## 5. Git – stabilna verzija

Commit poruka preporučena za backup prije implementacije automatskog fiskalnog sistema:

```
Fluxa pre-v1.0: fiskalne postavke, brojač faktura, dokumentacija

- Postavke fiskalnog uređaja (Studio/Firma, modal): Base URL, EsirKey, PIN, eksterni štampač
- Tabela firma_fiskal_settings, API GET/POST /api/firma/fiskal
- Brojač faktura: početna vrijednost po godini u Studio/Firma (bez polja u wizardu)
- create/storno fakture koriste max(fakture, brojac_faktura)+1
- API GET/POST /api/firma/brojac-faktura, BrojacFakturaCard na Firma stranici
- Docs: FLUXA-V1-FISKAL-NAPOMENE.md (urađeno, ostalo sutra, naputke)
Stabilna verzija prije povezivanja fiskalnog uređaja i automatske fiskalizacije.
```

---

*Zadnje ažurirano: večer prije implementacije automatskog fiskalnog sistema (Fluxa v1.0).*
