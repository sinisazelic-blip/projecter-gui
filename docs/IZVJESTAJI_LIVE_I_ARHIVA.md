# Izvještaji: live poslovanje + 20-godišnja istorija

*Cilj: svi izvještaji u Fluxi prikazuju i podatke iz redovnog poslovanja (testiranje / novi unos) i iz arhive (staging/legacy tabele) — ~5700 projekata, klijenti, talenti, dobavljači, situacije kroz 20 godina.*

---

## Strategija

Za svaki izvještaj:

1. **Live** — podaci iz operativnih tabela (`projekti`, `projektni_troskovi`, `fakture`, `klijenti`, `talenti`, `dobavljaci`, itd.).
2. **Arhiva** — podaci iz staging/legacy tabela (`stg_*`, `*_istorija`, `*_clean`, `projekti_finansije_cache`, itd.) gdje postoji historija.
3. **Spajanje** — u API-ju: učitaj live, učitaj arhivu (try/catch ako tabela ili kolone ne postoje), spoji po ključu (ID ili naziv), vrati jednu listu.

Granica datuma: arhiva obično do **31.12.2025**; od **1.1.2026** samo live (ili već spojeno u Grafičkom).

---

## Pregled po izvještaju

| Izvještaj | API | Live izvor | Arhiva / staging izvor | Status |
|-----------|-----|------------|------------------------|--------|
| **Grafički** (promet/troškovi/zarada po godini) | `stg-master` | fakture, projektni_troskovi (od 2026) | stg_master_finansije (do 31.12.2025) | ✅ Implementirano |
| **Talenti** | `talenti` | talenti, projektni_troskovi, placanja_stavke | stg_troskovi_talenti_old, talent_istorija | ✅ Implementirano |
| **Dobavljači** | `dobavljaci` | dobavljaci, projektni_troskovi, placanja_stavke | stg_troskovi_dobavljaci_old | ✅ Implementirano |
| **Klijenti** | `klijenti` | klijenti, projekti (narucilac_id), fakture | stg_master_finansije (narucilac_id / krajnji_klijent_id, iznos_km, id_po) do 31.12.2025 | ✅ Implementirano |
| **Projekti** | `projekti` | projekti, vw_projekti_finansije | stg_master_finansije, projekti_clean, projekat_id_map (mapiranje) | 📋 Planirano |
| **Potraživanja** | `potrazivanja` | fakture | Stare fakture u stagingu (ako postoje) | 📋 Ovisi o podacima |
| **Lista izdatih faktura** | `fakture-period` | fakture | stg_master_finansije (broj_fakture, datum_fakture, iznos_km) do 31.12.2025, agregirano po fakturi | ✅ Implementirano |
| **Knjiga prihoda** | `knjiga-prihoda` | fakture | Stare fakture (staging) | 📋 Ovisi o podacima |
| **PDV** | `pdv` | fakture | Stare fakture (staging) | 📋 Ovisi o podacima |
| **Fakture i naplate** | `fakture-naplate` | fakture, uplate | Stare fakture (staging) | 📋 Ovisi o podacima |
| **Banka** | `banka` | bank_* | Nema 20g historije u stagingu | — |
| **Fiksni troškovi** | `fiksni-troskovi` | fiksni_troskovi | Nisu se ranije vodili; Flux ih prvi put pravilno prati | Samo live |

---

## Staging / legacy tabele (iz ANALIZA-BAZE-DO.md)

| Tabela | Redova | Namjena za izvještaje |
|--------|--------|------------------------|
| stg_master_finansije | 5694 | Grafički (agregat); moguće Projekti (po projektu ako ima id) |
| stg_troskovi_talenti_old | 3104 | Talenti (ukupno po talentu) |
| stg_troskovi_dobavljaci_old | 378 | Dobavljači (ukupno po dobavljaču) |
| talent_istorija / talent_istorija_stage | 3178 / 2971 | Talenti (dopuna) |
| projekti_clean | 5851 | Projekti / Klijenti (ako ima narucilac_id, budžet) |
| projektni_troskovi_clean | 3305 | Troškovi po projektu (arhiva) |
| projekti_finansije_cache | 5694 | Projekti (budžet, troškovi, zarada) |
| stg_projekti_bridge / projekat_id_map | 5692 | Mapiranje stari PO id → projekat_id |

---

## Očekivane kolone (za try/catch u API-ju)

Ako neka tabela nema ove kolone, upit se preskače; izvještaj radi samo na live podacima.

- **stg_troskovi_talenti_old:** `talent_id` ili `naziv`/`ime_prezime`, `iznos_km`/`iznos`
- **stg_troskovi_dobavljaci_old:** `dobavljac_id` ili `naziv`, `iznos_km`/`iznos`
- **talent_istorija:** `talent_id`, `iznos_km`/`iznos`
- **stg_master_finansije:** `datum_zavrsetka`, `iznos_km`, `iznos_troska_km` (već korišteno)

- **Klijenti:** Arhiva iz `stg_master_finansije` — agregacija po `COALESCE(narucilac_id, krajnji_klijent_id)` (jedan klijent po redu), suma `iznos_km`, broj projekata po `id_po`, za `datum_zavrsetka <= 31.12.2025`. U istoriji nema posebnog koncepta naručioca — u stagingu koristimo te kolone da povežemo red sa klijentom.
- **Fiksni troškovi:** Nisu se ranije vodili; izvještaj samo live.
- **Projekti:** `projekti_clean` (id_po, radni_naziv, narucilac_id, budzet_planirani, datum_zavrsetka), `projekti_finansije_cache` (projekat_id, troskovi_ukupno) — moguće spojiti s live preko projekat_id / id_po.

---

## Strukture tabela (dostavljene)

**stg_master_finansije:** row_id, import_batch, id_po, naziv_projekta, datum_zavrsetka, iznos_km, vrsta_stavke (TALENT/DOBAVLJAC/OSTALO), talent_id, dobavljac_id, iznos_troska_km, opis, broj_fakture, datum_fakture, nacin_naplate, narucilac_id, krajnji_klijent_id, izvor_ref, created_at.

**projekti_finansije_cache:** projekat_id (PK), troskovi_ukupno, troskovi_novi, troskovi_legacy, updated_at.

**projekti_clean:** projekat_id (PK), id_po (UNI), radni_naziv, narucilac_id, krajnji_klijent_id, datum_zavrsetka, budzet_planirani, import_batch, created_at, broj_projekta.

---

## Budžet vs stari „iznos ukupno”

- **Flux:** budžet − troškovi = zarada (projekat ima budzet_planirani).
- **Stari model:** iznos (ukupno) − troškovi = zarada (nije postojao „budžet”, nego ukupan iznos / prihod).
- **Problem:** za stare projekte su importovani **troškovi**, ali ne i **iznosi** (revenue strana), pa stari projekti svi izgledaju u minusu. Pri pregledu izvještaja i dodavanju kolona — uvesti ili prikazati „iznos ukupno” iz arhive gdje postoji, da se stari projekti ne prikazuju samo kao minus.

---

## Sljedeći koraci

1. **Dobavljači** — uključiti stg_troskovi_dobavljaci_old (isti princip kao Talenti). ✅
2. **Klijenti** — agregat iz stg_master_finansije po COALESCE(narucilac_id, krajnji_klijent_id), datum_zavrsetka <= 31.12.2025. ✅
3. **Projekti** — koristiti stg_master_finansije ili projekti_finansije_cache + projekat_id_map za listu projekata s budžetom/troškovima iz arhive; spojiti s live listom (po projekat_id gdje postoji mapiranje).
4. **Fakturisani izvještaji** (potraživanja, lista faktura, knjiga prihoda, PDV) — ako postoji staging tabela sa starim fakturama, dodati blok za njih; inače ostaju samo live.
