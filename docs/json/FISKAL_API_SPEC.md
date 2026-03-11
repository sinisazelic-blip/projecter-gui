# Fiskalni uređaj (L-PFR / E-SDC) – API spec

*Službeni PU Create Invoice spec + primjeri iz ovog foldera. Status kodovi: **Status-and-Error-Codes.pdf**.*

---

## 1. Službeni spec (Create Invoice – PU dokumentacija)

**Endpoint:** `POST <E-SDC_URL>/api/v3/invoices` (npr. `http://192.168.88.112:8888/api/v3/invoices`).

**Authentication:** E-SDC **ne zahtijeva** autentifikaciju. V-SDC koristi digitalni certifikat klijenta.

**Request headers (obavezno):**

| Header | Opis |
|--------|------|
| `Accept` | `application/json` |
| `Content-Type` | `application/json` |
| `RequestId` | Jedinstveni ID zahtjeva (opciono, max 32 znaka) – za pretragu ako odgovor ne stigne |
| `Accept-Language` | Jedan ili više jezika (npr. `sr;en`) – utječe na jezik i format u journalu. Ako se ne šalje, SDC vraća prvi jezik iz Get Status |

**Body:** Direktan **InvoiceRequest** (nema wrappera `Request`/`invoiceRequest` u službenom spec-u):

- `dateAndTimeOfIssue` (optional) – ISO 8601
- `cashier` (optional, za BiH obično "Prodavac 1")
- `buyerId` (optional, max 20 znakova) – npr. `VP:4514096630008`
- `invoiceType` – "Normal" | "ProForma" | "Copy" | **"Training"** | "Advance" (ili 0–4). **Training** = testni račun: PU ne broji ga; pri provjeri u SUF-u korisnik dobija poruku „Ovo nije fiskalni račun”. Fluxa šalje `invoiceType: "Training"` kada je u preview URL-u `?training=1`.
- `transactionType` – "Sale" | "Refund" (ili 0–1)
- `payment` – niz `[{ amount, paymentType }]`, paymentType: "Cash" | "WireTransfer" | …
- `invoiceNumber` (optional, max 60 znakova)
- `items` – niz stavki (gtin 8–14 znakova, name, quantity, unitPrice, totalAmount, labels)
- `options` (optional) – npr. `omitQRCodeGen: "0"`, `omitTextualRepresentation: "0"`

**Fluxa:** Za path koji završava s `/api/v3/invoices` šalje **direktan** InvoiceRequest. Ako uređaj vrati 400/500, automatski se šalje još jedan zahtjev s **wrapper** formatom (v. ispod).

**Važno (PU instrukcije):** U zahtjev se smiju dodavati **samo polja definirana u spec-u**. Dodavanje polja koja nisu u dokumentaciji (npr. **discount**, **discountAmount** na stavkama) uzrokuje greške. Primjeri iz nekih uređaja mogu sadržavati `"discount": null` – to **ne slati**; Item ima samo: gtin, name, quantity, unitPrice, totalAmount, labels. Popust se predstavlja **dodatnom stavkom** s negativnim iznosom (ista polja).

**PDV oznake (labels) – test vs produkcija:** U praksi se dešava da test uređaji očekuju **latinicu** (`E`, `K`), a produkcija **ćirilicu** (`Е` U+0415, `К` U+041A). Ako se dobije greška **2310 Invalid tax labels**, Fluxa automatski pokušava ponovo sa drugim scriptom (latinica ⇄ ćirilica).

---

## 2. Wrapper format (primjeri IRN/RPA – neki uređaji/proxy)

**Body – wrapper (ako uređaj očekuje):**

```json
{
  "Request": {
    "invoiceRequest": {
      "invoiceType": "Normal",
      "transactionType": "Sale",
      "buyerId": "VP:4514096630008",
      "invoiceNumber": 72726,
      "payment": [
        { "amount": 1.50, "paymentType": "WireTransfer" }
      ],
      "items": [
        {
          "name": "TUBORG PIVO 0.33 NRB 24/1",
          "gtin": "00000000000006",
          "quantity": 1.000,
          "unitPrice": 1.50,
          "totalAmount": 1.50,
          "labels": ["Е"]
        }
      ]
    },
    "print": true
  }
}
```

**Polja:**

| Polje | Obavezno | Opis |
|-------|----------|------|
| `invoiceRequest.invoiceType` | da | `"Normal"` |
| `invoiceRequest.transactionType` | da | `"Sale"` |
| `invoiceRequest.invoiceNumber` | da* | Broj računa (brojčano, npr. broj u godini ili interni broj) |
| `invoiceRequest.payment` | da | Niz: `[{ "amount": number, "paymentType": "WireTransfer" \| "Cash" }]` |
| `invoiceRequest.items` | da | Niz stavki (v. ispod) |
| `invoiceRequest.buyerId` | ne | **Max 20 znakova.** Format `"VP:"` + max 17 cifara PIB/JIB (npr. `VP:4514096630008`) |
| `invoiceRequest.cashier` | ne | npr. `"KASA 1"` ili `"Prodavac 1"` |
| `Request.print` | ne | `true` = štampaj na uređaju |

**Stavka (item):**

| Polje | Opis |
|-------|------|
| `name` | Naziv (do 2048 znakova) |
| `gtin` | Službeni spec: 8–14 znakova (za RS obavezno). U primjerima 12 cifara, npr. `"00000000000000"` |
| `quantity` | Količina (number) |
| `unitPrice` | Cijena po jedinici (sa PDV-om ako uređaj očekuje bruto) |
| `totalAmount` | Ukupno za stavku |
| `labels` | Niz labela za PDV: `["Е"]` (ćirilično E = 17%), `["К"]` za 0%. **Ne dodavati** discount/discountAmount – nisu u PU spec-u. |

---

## 2. Odgovor – uspjeh

**Primjer:** `IRN-002-03877-26.json`

Odgovor je u `Response` objektu (ili direktno u body-ju, ovisno o endpointu). Korisna polja:

| Polje | Značenje |
|-------|----------|
| `invoiceNumber` | PFR broj računa (npr. `"8ZGRKDXK-8ZGRKDXK-73944"`) – snimiti u fakturu |
| `totalCounter` | Brojač (broj) |
| `transactionTypeCounter` | Brojač transakcija |
| `invoiceCounter` | Tekst brojača (npr. `"71027/73944ПП"`) |
| `sdcDateTime` | Vrijeme fiskalizacije (ISO string) |
| `verificationQRCode` | Base64 slika (QR/JPG) koju PU šalje |
| `verificationUrl` | URL za provjeru (PU) |
| `journal` | Tekstualni zapis računa (za štampu) |
| `messages` | npr. `"Успјешно"` |

Fluxa treba snimiti: **invoiceNumber** (PFR), **totalCounter**, **sdcDateTime**, **verificationQRCode**, **verificationUrl** za prikaz na PDF-u i u bazi.

**Slika na računu (zahtjev PU/servisera):** Na račun se stavlja **samo slika koju PU vraća** (npr. JPG u base64 u `verificationQRCode`), takva kakva je – aplikacija **ne smije** generirati QR od `verificationUrl` ili drugog koda (i ako bi skeniranjem dao isti rezultat, PU to ne dozvoljava). Ispod slike obavezno ispisati cijeli popis: PFR broj, broj računa, brojač, vrijeme – kako zahtijevaju.

---

## 3. Odgovor – uređaj nije dostupan

**Primjeri:** `IRN-002-03795-26_Error_Execute.json`, `IRN-002-03885-26_TerminalUnavailable.json`

```json
{
  "Request": { ... },
  "Response": "Uređaj nije dostupan"
}
```

`Response` je **string**, ne objekt. Fluxa treba prepoznati ovaj slučaj i vratiti korisniku poruku (npr. „Fiskalni uređaj nije dostupan”).

---

## 4. Odgovor – greška štampača (fiskalizacija uspjela)

**Primjer:** `PrintError.json`

```json
{
  "Request": { ... },
  "Response": {
    "details": null,
    "message": "Printer error: java.lang.Exception: printInit failed (result: 138)",
    "statusCode": -2,
    "invoiceResponse": {
      "invoiceNumber": "8ZGRKDXK-8ZGRKDXK-16303",
      "totalCounter": 16303,
      "sdcDateTime": "2025-02-03T11:00:17.562+01:00",
      "verificationQRCode": "...",
      "verificationUrl": "...",
      "journal": "...",
      ...
    }
  }
}
```

- **statusCode: -2** i **message** sadrže „Printer error” → fiskalizacija je **uspjela**, ali štampanje nije.
- Koristiti **invoiceResponse** za PFR broj, QR, brojač itd. i snimiti u fakturu; korisniku prikazati upozorenje da štampa nije uspjela.

---

## 5. Mapiranje u Fluxu

- **buyerId:** ako imamo PIB/JIB kupca → `"VP:" + samo_cifre(PIB)`; inače može izostaviti ili 13 devetki za INO.
- **invoiceNumber:** broj fakture u godini (npr. iz `brojac_faktura` / `fakture.broj_u_godini`) – brojčano polje.
- **paymentType:** „WireTransfer” za virmansko, „Cash” za gotovinu.
- **labels:** PDV 17% → `["Е"]` (ćirilično \u0415), 0% → `["К"]` (\u041A).
- **gtin:** 12 znakova (npr. `"00000000000000"` ako nemamo barkod).

---

## 6. Status i error kodovi (Status and Error Codes)

Svi protokoli dijele iste Info / Warning / Error kodove. Fluxa ih mapira i u odgovoru vraća `fiscalCode`, `fiscalCodeHint` i `retryable` (da li korisnik može pokušati ponovo).

| Kod | Tip | Opis | Retryable |
|-----|-----|------|-----------|
| 0000 | Info | All OK | – |
| 0100 | Info | Pin OK | – |
| 0210 | Info | Internet Available | – |
| 0220 | Info | Internet Unavailable | Da |
| 1100 | Warning | Storage 90% Full – vrijeme za audit | Da |
| 1300 | Warning | Smart Card is not present | Da |
| 1400 | Warning | Audit Required (75% limita) | Da |
| 1500 | Warning | Pin Code Required | Da |
| 1999 | Warning | Undefined Warning | Da |
| 2100 | Error | Pin Not OK | Da |
| 2110 | Error | Card Locked (previše PIN pokušaja) | **Ne** (trajno) |
| 2210 | Error | SE Locked – potreban audit | Da |
| 2220 | Error | SE Communication Failed | Da |
| 2230 | Error | SE Protocol Mismatch | Da |
| 2310 | Error | Invalid tax labels | Da |
| 2400 | Error | Not configured | Da |
| 2800 | Error | Field Required | Da |
| 2801–2809 | Error | Field value/length/format (v. PU dokument) | Da / **Ne** (2809) |
| 2811–2820 | Error | Obsolete (dužine polja, tipovi) – zamijenjeno s 2803/2805 | Da |

**Napomena:** statusCode **-2** nije četveroznamenkasti PU kod – označava grešku štampača; fiskalizacija je uspjela, podaci su u `invoiceResponse`.

---

*Primjeri u folderu: IRN-002-03877-26.json (uspjeh), IRN-002-03795-26_Error_Execute.json i IRN-002-03885-26_TerminalUnavailable.json (uređaj nije dostupan), PrintError.json (greška štampača), RPA-001-00054-26-103331.json (samo zahtjev).*
