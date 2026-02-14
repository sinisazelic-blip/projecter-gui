# Analiza baze na DO — šta imamo i šta dobijamo

## Ukupna slika

- **~95 tabela** + **~35 view-ova**
- **~50 MB** podataka (projektni_troskovi, projekti, stg_*)
- Baza je uglavnom zdrava, ali ima **legacy/staging** sloja i **potencijalnih problema**

---

## Kritično — provjeri odmah

### 1. `brojac_faktura` — neslaganje kolona

| Šta API očekuje | Šta DO ima |
|-----------------|------------|
| `zadnji_broj_u_godini` | `zadnji_broj` |

**Rizik:** Kreiranje fakture može padati ako kolona ne postoji.

**Ispravka:**
```sql
-- Provjeri kolone
SHOW COLUMNS FROM brojac_faktura;

-- Ako ima samo zadnji_broj, dodaj ili preimenuj:
ALTER TABLE brojac_faktura 
  CHANGE COLUMN zadnji_broj zadnji_broj_u_godini INT NOT NULL DEFAULT 0;
-- (ili ADD COLUMN ako obje postoje — onda treba migracija)
```

---

## Da li se isplati raditi optimizaciju?

### Kratki odgovor: **Da, ali selektivno**

| Akcija | Dobitak | Rizik |
|--------|---------|-------|
| Čišćenje praznih/nekorištenih tabela | Manji prostor, jasnija struktura | Nizak (ako nemaš referenci) |
| Arhiviranje starih staging podataka | Brži upiti, manje “buke” | Srednji (backup obavezan) |
| Uklanjanje backup tabele | ~0.09 MB | Nizak |
| Brisanje inventory (ako ne koristiš) | ~0.13 MB | Srednji (nema UI) |

**Ukupna ušteda:** Nije velika (~1–2 MB), ali struktura postaje preglednija.

---

## Kategorije tabela

### Operativne (drže aplikaciju — ne diraj)

- `projekti`, `projektni_troskovi`, `inicijacije`, `inicijacija_stavke`
- `klijenti`, `dobavljaci`, `talenti`, `radne_faze`, `cjenovnik_stavke`
- `fakture`, `faktura_projekti`, `bank_*`, `placanja`, `projektni_prihodi`
- `firma_profile`, `firma_bank_accounts`, `users`, `roles`
- `projekat_stavke`, `projekat_faze`, `project_audit`, `deal_timeline_events`
- `fiksni_troskovi`, `projekt_potrazivanja`, `projekt_dugovanja`, itd.

### Legacy / staging (za čišćenje ili arhiviranje)

| Tabela | Redova | Napomena |
|--------|--------|----------|
| `projekti_clean` | 5851 | Verovatno kopija projekata |
| `projektni_troskovi_clean` | 3305 | Verovatno kopija troškova |
| `stg_master_finansije` | 5694 | Staging za import |
| `stg_projekti_bridge` | 5692 | Mapiranje legacy → novi |
| `projekat_id_map` | 5692 | Mapiranje PO → projekat |
| `projekti_krajnji_stage` | 5466 | Staging |
| `projekti_finansije_cache` | 5694 | Cache (možda se koristi) |
| `projekat_operativni_signal_log` | 5761 | Log |
| `talent_istorija`, `talent_istorija_stage` | 3178, 2971 | Istorija |
| `stg_troskovi_talenti_old`, `stg_troskovi_dobavljaci_old` | 3104, 378 | Stari import |
| `stg_master_finansije__backup_2026_01_26` | 0 | Backup — može se obrisati |

### Prazne (0 redova) — odluči po namjeni

**Sigurno za brisanje (ako nemaš plan da ih koristiš):**

- `stg_master_finansije__backup_2026_01_26` — backup tabela
- `stg_projektni_troskovi_import`, `stg_troskovi_import`, `stg_troskovi_po` — prazni staging

**Ostavi (koriste se ili će se koristiti):**

- `brojac_faktura`, `brojac_fiskalni` — brojači
- `bank_tx_cost_link`, `bank_tx_fixed_link` — link tabele
- `placanja_stavke`, `projekt_dugovanja`, `projekt_dugovanje_placanje_link`
- `projekt_potrazivanje_prihod_link`, `kuf_ulazne_fakture`, `krediti`
- `inventory_*` — ako planiraš inventar
- `fx_rates` — kursna lista (vw_projekti_finansije je koristi)
- `radnici`, `sc_layouts` — šifarnici

**Provjeri prije brisanja:**

- `troskovi`, `ulazne_fakture`, `uplate` — stari model?
- `faktura_stavke` — možda zamijenjeno sa `faktura_projekti.opisne_stavke`
- `deal_audit` — prazan, ali može biti namjenski

---

## Preporučeni koraci (redom)

### 1. Hitno — `brojac_faktura`

```sql
-- Provjeri
SELECT * FROM brojac_faktura LIMIT 1;
SHOW COLUMNS FROM brojac_faktura LIKE 'zadnji%';

-- Ako ima zadnji_broj a nema zadnji_broj_u_godini:
ALTER TABLE brojac_faktura 
  CHANGE COLUMN zadnji_broj zadnji_broj_u_godini INT NOT NULL DEFAULT 0;
```

### 2. Niskorizično — backup tabela

```sql
-- Samo ako si siguran da ti ne treba
DROP TABLE IF EXISTS stg_master_finansije__backup_2026_01_26;
```

### 3. Opciono — arhiviranje starih staging podataka

Ako su `stg_*` i `*_clean` tabele samo za jednokratni import i više se ne koriste:

1. Napravi backup baze
2. Razmisli o `TRUNCATE` ili `DROP` za tabele koje su 100% nepotrebne
3. **Ne briši** `projekti_finansije_cache` i `vw_projekti_finansije` bez provjere — mogu se koristiti

---

## Šta dobijaš optimizacijom

| Akcija | Efekat |
|--------|--------|
| Ispravi `brojac_faktura` | Fakture se mogu kreirati bez greške |
| Obriši backup tabelu | Manje zbunjenosti, ~0.09 MB manje |
| Dokumentuj legacy tabele | Jasnija slika šta je aktivno |
| Ostavi ostalo | Nema potrebe za agresivnim čišćenjem |

**Zaključak:** Vrijedi uraditi ispravku `brojac_faktura` i ukloniti backup tabelu. Za ostalo — backup pa pažljivo, jer mnoge “legacy” tabele mogu biti u upotrebi kroz view-ove ili import skripte.
