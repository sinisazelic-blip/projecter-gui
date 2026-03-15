# Demo Fluxa = ista aplikacija, lažna baza

## Načelo

**Demo verzija mora biti identična pravoj Fluxi po funkcionalnosti.** Jedina razlika: koristi **demo bazu** sa lažnim podacima (klijenti, projekti, dealovi, fakture itd.). Korisnik koji plaća mora vidjeti cijeli engine – ne "ograničenu demo verziju".

- **Ista aplikacija** – svi moduli, FINAL OK, Close, bank import, izvještaji, faze, fakture, sve kao na produkciji.
- **Lažna baza** – `DEMO_DB_NAME` / `studio_db_demo`, seed-ovani fake podaci.

## Šta seed-demo.js radi

Seed **ne skriva** niti **ne isključuje** alate. Samo:

1. **Šifarnici (paritet s produkcijom)**  
   - **statusi_projekta** – 12 statusa (1–12), da FINAL OK i Close rade.  
   - **projekt_statusi** – 12 redova za API project-statuses.  
   - **statusi** (inicijacije) – novo, otvorena, dobijena, izgubljena.  
   - **radne_faze**, **cjenovnik_stavke** – minimalni set za prikaz.

2. **Korisnik za demo**  
   - user `demo` / pass `demo`, role Demo.

3. **Lažni podaci**  
   - klijenti, projekti, talenti, dobavljači, inicijacije, 2 fakture, 1 izvod (bank batch + staging).

Ako demo baza već ima samo dio šifarnika (npr. stari seed sa 3 statusa), seed **dopunjava** nedostajuće (npr. status_id 4–12) da engine radi.

## Šta aplikacija ne radi na Demo

- **Ne** skriva stranice ili dugmad za "demo mode".
- **Ne** koristi drugačiji build ili feature flag koji isključuje module.
- Jedina posebnost: na domeni `demo.*` naslov je "Fluxa - DEMO" i jezik se forsira na engleski (za europske klijente).

## Ako postojeća demo baza ima samo 3 statusa

Pokreni na demo bazi (lokalno ili na hostu):

```bash
# statusi_projekta (FK za projekti.status_id) – obavezno za FINAL OK / Close
mysql -u ... -p studio_db_demo < scripts-RedDellvill/fix-demo-statusi-projekta-1-12.sql

# projekt_statusi (API project-statuses)
mysql -u ... -p studio_db_demo < scripts-RedDellvill/fix-demo-projekt-statusi-1-12.sql
```

Ili ponovo pokreni cijeli seed (dopuni što fali):

```bash
node scripts/seed-demo.js
```

(Postavi u `.env.local`: `DB_NAME=studio_db_demo` i ostale `DB_*`.)

---

## Kako pokrenuti seed (nova ili prazna demo baza)

1. U rootu projekta otvori ili kreiraj **`.env.local`** i postavi parametre za **demo bazu**:
   ```env
   DB_NAME=studio_db_demo
   DB_HOST=...
   DB_PORT=3306
   DB_USER=...
   DB_PASSWORD=...
   ```

2. Iz roota projekta pokreni:
   ```bash
   node scripts/seed-demo.js
   ```

3. U konzoli će se ispisati šta je ubaceno (statusi, klijenti, projekti, talenti, dobavljači, inicijacije, fakture, izvod). Osvježi aplikaciju (demo login: demo / demo).

Ako baza već ima podatke, seed dopunjava samo šifarnike i određene blokove (npr. statusi 4–12 ako nedostaju); glavni INSERT-i za klijente/projekte/talente rade samo kada je tabela prazna.
