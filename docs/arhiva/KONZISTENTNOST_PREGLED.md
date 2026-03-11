# Pregled konzistentnosti (bez promjene funkcionalnosti)

Skener: što doprinosi profesionalnom izgledu, jedna stavka po jednu. **Ne dirati logiku.**

---

## Što je već dobro

- **Logo + slogan** na svim stranicama (brandLogoBlock, brandSlogan)
- **Zajednički layout:** `pageWrap` → `topBlock` → `topInner` → `topRow` (većina stranica)
- **common-styles.css:** `.actions`, `.topbar-right`, `.btn`, `.card`, `.label`, `.input`, varijable (--text, --muted, --border)
- **globals.css:** :root varijable, .container, .table

---

## Predložene stavke (samo izgled, redom)

1. **Ukloniti redundantne inline stilove**  
   Gdje se koristi `className="actions"` ili `className="topbar-right"` a uz to i `style={{ display: "flex", gap: 8 }}` – te vrijednosti već daje CSS. Ukloniti samo inline da ne dupliramo; ponašanje ostaje isto.  
   *Rizik: nula. Prva stavka: jedna stranica kao pilot.*

2. **Divider ispod topRow** ✅  
   Neke stranice imaju `<div className="divider" />` nakon topRow, neke nemaju. Usklađeno: dodan divider na stranice koje su imale topBlock/topInner a nisu ga imale: **Faktura detalj** (`fakture/[id]`), **Faktura wizard 2/3** (`fakture/wizard`), **Deal detalj** (`inicijacije/[id]`).  
   *Rizik: nizak – samo vizual.*

3. **Konzistentan naziv dugmeta za Dashboard** ✅  
   Usklađeno: sva dugmad/linkovi za povratak na Dashboard sada imaju tekst **"🏠 Dashboard"** i gdje je falilo dodan je `title="Dashboard"`. Izmijenjeno: Faktura wizard (2/3), Faktura wizard preview (3/3), Narudžbenice preview, Svi izvještaji (SviIzvjestajiClient), Dugovanje detalj (title). *Izuzetak:* Firma stranica ima link "Odustani" koji vodi na /dashboard – ostavljen kao semantički "Odustani".  
   *Rizik: nula.*

4. **Kartice (card) – jedan padding** ✅  
   Zajednički padding za `.card` je **14px** (globals.css, common-styles.css). Uklonjeni override-i paddinga: SviIzvjestajiClient (padding: 24), Fiksni troškovi – Napomena kartica (padding: 18 + border/radius), FazeClient loading (padding: 24), FazeGantt prazno stanje (padding: 24). Margin override-i (marginTop, marginBottom) ostavljeni – nisu dirani.  
   *Rizik: nizak.*

5. **Tabele – jedan set klasa** ✅  
   Dodani `.table` i `.table-wrap` tamo gdje su tabele bile bez tih klasa: **Fiksni troškovi** (lista), **Dugovanja** (lista), **Za fakturisanje** (InvoicePickClient), **Faktura wizard preview** (stavke), **Faktura [id] preview** (stavke), **Izvodi [id]** (transakcije), **Banking import** (unmatched, matched, raw preview). Ostale tabele već su koristile `className="table"`; colgroup nije namećen.  
   *Rizik: nizak.*

6. **Forme – label + input** ✅  
   Usklađeno: forme koriste zajedničke klase `.label`, `.input` i `.field` iz common-styles. Izmijenjeno: **Svi izvještaji** (label + field za tip izvještaja i datume), **Izvodi** (filter – label + input small), **Fakture** (filter – label + input), **Projekat [id]** (budžet za tim – label), **Faktura wizard** (checkbox label). Inputi su već uglavnom imali `className="input"`; uklonjeni su redundantni inline stilovi (padding, fontSize) tamo gdje .input već to definiše.  
   *Rizik: nizak.*

---

## Kako radimo

- Rješavamo **samo jednu stavku** po jednu.
- Ti odobriš ili kažeš "preskoči".
- Nakon tvoje potvrde ("ok" / "nema problema"), prelazimo na sljedeću.

**Prva stavka:** Ukloniti redundantni inline style na **jednoj** stranici (pilot): npr. Fiksni troškovi — raspored, gdje `topbar-right` već ima u CSS-u `display: flex`, `gap`, `flex-wrap`. Ako ti to odgovara, to je prva i jedina izmjena u ovom koraku.
