# Logo na DigitalOcean App Platform (trajni upload)

Na App Platformu disk aplikacije je **efemeran** – pri redeployu se briše. Da upload logotipa ostane trajan, koristi se **Volume**.

## Koraci u DigitalOcean dashboardu

1. Otvori svoj **App** (Fluxa) u App Platformu.
2. Idi na **Settings** (ili **Resources**).
3. Dodaj **Volume**:
   - **Add Volume**
   - Ime npr. `logos`
   - Mount path: **`/data`** (ili npr. `/data/logos` ako platform to podržava; inače mount na `/data`, a aplikacija koristi `/data/logos`).
4. U **App-Level Environment Variables** dodaj:
   - **Name:** `UPLOAD_PATH`
   - **Value:** `/data/logos`

Ako Volume mount path mora biti samo `/data`, aplikacija će kreirati podfolder `logos` unutar njega (to radi `mkdir(dir, { recursive: true })` u upload ruti).

5. Sačuvaj i **redeploy** aplikaciju (da se Volume mount učita).

## Kako radi

- **Bez** `UPLOAD_PATH` (lokalno / stari setup): logo se upisuje u `public/logos/` i servira preko **GET /api/firma/logo**.
- **Sa** `UPLOAD_PATH=/data/logos` (App Platform + Volume): logo se upisuje u Volume na `/data/logos/`, pri redeployu ostaje, a **GET /api/firma/logo** čita fajl odatle i servira ga.

Na fakturi i u Firma prozoru logo se učitava preko **/api/firma/logo**, tako da uvijek ide iz jednog mjesta (Volume ili public).
