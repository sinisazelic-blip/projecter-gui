# Demo baza i prikaz u aplikaciji

## Kako vidjeti demo podatke

1. **Postavi aplikaciju na demo bazu**  
   U `.env.local` stavi:
   ```env
   DB_NAME=studio_db_demo
   ```
   (ostale varijable ostaju iste: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`.)

2. **Pokreni seed (jednom)**  
   Iz root foldera projekta:
   ```bash
   node scripts/seed-demo.js
   ```
   Skripta ubacuje lažne klijente, projekte, talente, dobavljače i minimalne šifarnike u bazu koja je u `DB_NAME`.

3. **Pokreni aplikaciju i otvori UI**  
   ```bash
   npm run dev
   ```
   Otvori npr.:
   - **Studio → Klijenti** – vidjet ćeš Demo TV d.o.o., Agencija Demo, Ino Client Ltd.
   - **Projekti (PP)** – vidjet ćeš Demo kampanja 2026, Spot za brend X, Event pokroviteljstvo.
   - **Studio → Talenti** – Demo Spiker, Demo Glumac, Demo Muzičar.
   - **Studio → Dobavljači** – Demo Studio, Demo Freelancer.
   - **Studio → Cjenovnik** – demo stavke.

Sve što aplikacija prikazuje čita iz baze iz `.env.local`; dok je `DB_NAME=studio_db_demo`, prikazuješ **samo** demo bazu.

## Prelazak na pravu bazu

U `.env.local` promijeni:
```env
DB_NAME=studio_db
```
Restartuj dev server (`Ctrl+C`, pa `npm run dev`). Aplikacija će opet raditi na produkcijskoj bazi.

## Šta seed ubacuje

- **statusi_projekta** i **projekt_statusi** – statusi projekta (U pripremi, Aktivan, Zatvoren).
- **statusi** – statusi za inicijacije/deals (Otvorena, Dobijena, Izgubljena).
- **klijenti** – 3 demo klijenta.
- **projekti** – 3 demo projekta (povezani na te klijente).
- **talenti** – 3 demo talenta.
- **dobavljaci** – 2 demo dobavljača.
- **radne_faze** – 3 faze (Preprodukcija, Produkcija, Postprodukcija).
- **cjenovnik_stavke** – 3 demo stavke.

Ako neka tabela već ima podatke, seed je preskače (ne briše ni duplira).
