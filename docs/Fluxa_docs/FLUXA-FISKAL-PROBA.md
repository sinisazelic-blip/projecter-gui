# Fluxa – šta probati prije hvatanja zahtjeva (fiskalni uređaj)

Kratke korake koje možeš uraditi iz onoga što imamo (dokumentacija + config od prijatelja), prije nego kreneš hvatanje zahtjeva (Fiddler/Wireshark) sa računara gdje JP Aquana radi.

---

## 1. Ažuriraj bazu (jednom)

Dodana je opciona kolona **YID** za identifikator uređaja u headeru. Pokreni:

```sql
-- U MySQL-u, na bazi projekta:
source scripts/alter-firma-fiskal-add-yid.sql
```

Ili kopiraj sadržaj `scripts/alter-firma-fiskal-add-yid.sql` i izvrši u klijentu.

---

## 2. Postavke u Fluxi (Studio → Firma → Postavke fiskalnog uređaja)

- **Base URL:** točno `http://192.168.70.156:3566` ili `http://192.168.70.156:3566/` (oba rade).
- **Putanja API-ja:** ostavi **prazno** (iz njihovog configa cilj je root, nema patha).
- **API ključ (EsirKey):** prvo onaj koji ti je serviser dao. Ako i dalje dobijaš 404, probaj format kao u configu: 32 heksadecimalna znaka (npr. `71e5ba208f5f6c8325ac53b8e34a3669`). Na tvom uređaju trebao bi biti **tvoj** ključ – ako ga imaš u postavkama uređaja ili od servisera, upiši ga.
- **YID / ID uređaja:** opciono. Ako prijatelj ima u configu `YIDLLocalHardvare` (npr. `WHH3YDEB`), na svom uređaju možeš imati sličan ID. Možeš probati upisati ga ovdje; Fluxa ga šalje u headerima `X-Esir-YID` i `YID`. Ako nemaš – ostavi prazno.
- **PIN:** može ostati prazan. PIN služi za otključavanje uređaja ujutro; ne šaljemo ga pri svakom zahtjevu za fiskalizaciju.

Klikni **Snimi postavke**.

---

## 3. Test iz wizarda (Preview → Fiskalizuj)

1. Otvori wizard fakture, dođi do koraka 3/3 (Preview).
2. Klikni **Fiskalizuj**.
3. Ako dobiješ **404**: uređaj prima zahtjev na nekoj drugoj putanji koju mi ne znamo – tada hvatanje zahtjeva (korak 5) ima smisla.
4. Ako dobiješ **timeout** ili **fetch failed**: provjeri mrežu (ping 192.168.70.156), vatrogasni zid, da li je uređaj u istoj mreži.
5. Ako dobiješ **401/403**: ključ ili YID su vjerovatno pogrešni – probaj drugi API ključ ili YID.

---

## 4. Test iz PowerShell-a (bez Fluxe)

Možeš testirati direktno prema uređaju:

1. Otvori `scripts/test-fiskal-curl.ps1`.
2. U varijabli `$esirKey` stavi pravi API ključ (onaj iz postavki).
3. Pokreni skriptu. URL je već postavljen na `http://192.168.70.156:3566/` (root).

Ako i ovdje dobiješ 404, problem je u pathu ili u tome što uređaj očekuje drugačiji format zahtjeva – tada hvatanje stvarnog zahtjeva iz JP Aquane je sljedeći korak.

---

## 5. Ako i dalje 404 – hvatanje zahtjeva

Na računaru gdje **JP Aquana uspješno šalje** račun na fiskalni uređaj:

1. Instaliraj **Fiddler** ili **Wireshark**.
2. Pokreni hvatanje.
3. U JP Aquani pošalji jedan račun na fiskalni uređaj.
4. U hvatanju pronađi **HTTP POST** prema `192.168.x.x:3566` (ili tvojoj IP uređaja).
5. Zapiši:
   - **tačan URL** (path iza porta, npr. `/api/...`),
   - **headere** (nazivi i vrijednosti),
   - **body** (JSON).

Kad to imaš, u Fluxi u **Putanja API-ja** unesi taj path (npr. `/api/v1/invoice`), a u kodu možemo uskladiti body/headere ako treba.

---

## Šta je u kodu (sažetak)

- **Fiskalizuj** šalje na `base_url + api_path` (prazan path = root).
- Headeri: `EsirKey`, `X-Esir-Key`, `Authorization: Bearer <api_key>`. Ako je unesen YID: `X-Esir-YID`, `YID`.
- PIN se **ne šalje** u zahtjevu (samo za otključavanje uređaja).
- Body je po PU Create Invoice formatu: `dateAndTimeOfIssue`, `invoiceType`, `transactionType`, `payment`, `items` (gtin, name, quantity, unitPrice, totalAmount, labels).
