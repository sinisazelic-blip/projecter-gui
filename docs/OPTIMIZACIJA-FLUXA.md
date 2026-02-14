# Fluxa — Plan optimizacije stranica i baze

## 1. Analiza stranica (56 ukupno)

### ✅ Stranice u upotrebi (Dashboard ili unutrašnji linkovi)

| Putanja | Opis |
|---------|------|
| `/` | Home → Dashboard |
| `/dashboard` | Glavni dashboard |
| `/inicijacije` | Deals lista |
| `/inicijacije/novo` | Novi deal |
| `/inicijacije/[id]` | Deal detalj |
| `/projects` | Pregled projekata |
| `/projects/[id]` | Projekat detalj |
| `/projects/[id]/faze` | Faze projekta |
| `/projects/[...slug]` | Catch-all (vidi napomenu) |
| `/fakture` | Lista faktura |
| `/fakture/za-fakturisanje` | Wizard ulaz |
| `/fakture/wizard` | Wizard korak 2/3 |
| `/fakture/wizard/preview` | Wizard korak 3/3 |
| `/fakture/[id]` | Faktura detalj |
| `/fakture/[id]/preview` | Faktura preview |
| `/narudzbenice` | Narudžbenice |
| `/narudzbenice/preview` | Narudžbenica preview |
| `/naplate` | Naplate |
| `/izvodi` | Bankovni izvodi |
| `/izvodi/[id]` | Izvod detalj |
| `/banking/import` | Import izvoda |
| `/banking/rules` | Bank rules |
| `/banking` | Bank batches (alternativni ulaz?) |
| `/finance` | Finance hub |
| `/finance/banka` | Banka |
| `/finance/banka/[posting_id]` | Posting detalj |
| `/finance/prihodi` | Prihodi |
| `/finance/prihodi/[id]` | Prihod detalj |
| `/finance/placanja` | Plaćanja |
| `/finance/placanja/[id]` | Plaćanje detalj |
| `/finance/potrazivanja` | Potraživanja |
| `/finance/potrazivanja/[id]` | Potraživanje detalj |
| `/finance/dugovanja` | Dugovanja |
| `/finance/dugovanja/[id]` | Dugovanje detalj |
| `/finance/kuf` | KUF |
| `/finance/cashflow` | CashFlow |
| `/finance/krediti` | Krediti |
| `/finance/fiksni-troskovi` | Fiksni troškovi |
| `/finance/fiksni-troskovi/raspored` | Raspored |
| `/izvjestaji/svi` | Svi izvještaji |
| `/izvjestaji/graficki` | Grafički izvještaji |
| `/studio/firma` | All About Us |
| `/studio/radne-faze` | Radne faze |
| `/studio/radnici` | Radnici |
| `/studio/users` | Korisnici |
| `/studio/roles` | Uloge |
| `/studio/cjenovnik` | Cjenovnik |
| `/studio/talenti` | Talenti |
| `/studio/dobavljaci` | Dobavljači |
| `/studio/klijenti` | Klijenti |
| `/studio/strategic-core` | Strategic Core |
| `/studio/finance-tools` | Finance Tools |
| `/mobile` | Mobile verzija |
| `/cash` | Blagajna |

---

### ⚠️ Bespotrebne / placeholder stranice

| Putanja | Status | Preporuka |
|---------|--------|-----------|
| **`/bank2`** | Placeholder "BANK2 OK" | **UKLONITI** — nigdje nije linkovan |
| **`/cjenovnik`** | Standalone cjenovnik (client-side) | **UKLONITI** — Dashboard linkuje na `/studio/cjenovnik`. Duplikat funkcionalnosti. |

---

### 🔧 Bugovi za ispravku

| Lokacija | Problem | Ispravka |
|----------|---------|----------|
| `banking/page.tsx` | `href="/bank/rules"` | Treba `/banking/rules` |
| `CloseProjectModal.tsx` | `bankImportHref = "/bank"` | Treba `/banking/import` (ruta `/bank` ne postoji) |

---

### ❓ Za provjeru

| Stranica | Napomena |
|----------|----------|
| `projects/[...slug]` | Catch-all route. `projects/[id]` već hvata `/projects/123`. Možda legacy — provjeri da li se koristi za nešto specifično. |
| `banking` (root) | Prikazuje batches. Dashboard linkuje na `banking/import`. Da li je banking root potreban? Možda je alternativni ulaz u import flow. |
| **Inventory** | Postoje `actions/inventory/*` i tabele `inventory_*`, ali nema UI stranice u Dashboardu. Modul u izgradnji ili napušten? |

---

## 2. Baza podataka (DO — DigitalOcean)

### Tabele u upotrebi (iz SQL upita u kodu)

- `projekti`, `statusi_projekta`, `vw_projekti_finansije`
- `inicijacije`, `inicijacija_stavke`, `deal_timeline_events`
- `klijenti`, `dobavljaci`, `talenti`, `radnici`, `radne_faze`
- `projektni_troskovi`, `projektni_prihodi`, `placanja`, `placanja_stavke`
- `projekt_potrazivanja`, `projekt_dugovanja`, `projekt_dugovanje_placanje_link`
- `fakture`, `faktura_projekti`, `brojac_faktura`
- `kuf_ulazne_fakture`, `fiksni_troskovi`, `krediti`
- `bank_import_batch`, `bank_tx_staging`, `bank_tx_posting`, `bank_tx_*_link`
- `cjenovnik_stavke`, `projekat_stavke`, `projekat_faze`, `projekat_faza_*`
- `firma_profile`, `firma_bank_accounts`
- `users`, `roles`, `project_audit`
- `sc_layouts`, `sc_layout_cells`
- `inventory_items`, `inventory_locations`, `inventory_movements` (ako se koristi)
- `stg_master_finansije` (izvještaji)
- View-ovi: `v_bank_posting_feed`, `v_potrazivanja_paid_sum`, `v_dugovanja_paid_sum`, `vw_fiksni_troskovi_*`

### Preporuke za bazu na DO

1. **Backup prije bilo kakvih promjena**
   ```bash
   mysqldump -u USER -p -h DO_HOST DATABASE > backup_$(date +%Y%m%d).sql
   ```

2. **Provjera nekorištenih tabela**
   - Ako inventory nije u upotrebi: `inventory_items`, `inventory_locations`, `inventory_movements`, `v_inventory_balance` — označiti za eventualno uklanjanje (ili ostaviti ako planiraš koristiti).

3. **Indeksi**
   - Provjeri da li postoje indeksi na često filtrirane kolone (npr. `status_id`, `datum_*`, `narucilac_id`).

4. **Čišćenje**
   - Stare audit zapise, logove — eventualno arhiviranje ili brisanje starih podataka (pažljivo, samo ako imaš backup).

5. **Migracije**
   - Svi `scripts/*.sql` fajlovi — provjeri da li su svi pokrenuti na DO. Npr. `fix-faktura-projekti-opisne-stavke.sql` za opisne stavke.

---

## 3. Akcijski plan

### Faza 1 — Brze ispravke (bez rizika)
- [ ] Ispraviti `banking/page.tsx`: `/bank/rules` → `/banking/rules`
- [ ] Ispraviti `CloseProjectModal.tsx`: `bankImportHref` → `/banking/import`

### Faza 2 — Uklanjanje bespotrebnih stranica
- [ ] Obrisati `src/app/bank2/` (placeholder)
- [ ] Obrisati `src/app/cjenovnik/` (duplikat — koristi se `/studio/cjenovnik`)

### Faza 3 — Baza (DO)
- [ ] Napraviti backup
- [ ] Provjeriti da li su sve migracije pokrenute
- [ ] Odlučiti o inventory tabelama (koristiti ili ne)

### Faza 4 — Opciono
- [ ] Pregledati `projects/[...slug]` — ukloniti ako je redundantan
- [ ] Dodati inventory u Dashboard ako planiraš koristiti
