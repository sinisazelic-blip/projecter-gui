# Deploy Fluxe na DigitalOcean App Platform

## 1. GitHub repozitorijum

- Na GitHubu (sinisazelic-blip) napravi **novi prazan repozitorijum** (npr. `projecter-gui`). Ne dodavaj README/licence (već postoje u projektu).

## 2. Lokalno: poveži i push

U rootu projekta (`projecter-gui`) pokreni (zamijeni `TvojGitHubUsername` ako koristiš drugi):

```powershell
cd "c:\Users\Studio\OneDrive\Desktop\projecter-gui"

# Poveži GitHub repo (ako si napravio projecter-gui)
git remote add origin https://github.com/sinisazelic-blip/projecter-gui.git

# Prvi push (tražit će se login/token za GitHub)
git push -u origin fix/status-flow
```

Ako želiš da DO gradi sa grane `main`, prvo gurni i main:

```powershell
git push origin fix/status-flow:main
```

Ili prebaci na main i pushuj:

```powershell
git checkout main
git merge fix/status-flow
git push -u origin main
```

## 3. DigitalOcean App Spec

U DO konzoli: **Apps → studio → App Spec → Edit**.

Za komponentu **studiotaf** (Web Service) postavi:

- **Repo:**  
  `https://github.com/sinisazelic-blip/projecter-gui.git`  
  (ili tačan URL repoa u koji si pushovao)

- **Branch:**  
  `main` (ili `fix/status-flow` ako deployuješ tu granu)

- **Build Command:**  
  `npm ci && npm run build`

- **Run Command:**  
  `npm run start`

Sačuvaj spec — pokreće se novi deploy.

## 4. Environment variables (studiotaf)

U **Settings → App-Level** ili **Component-Level** za studiotaf dodaj:

- `AUTH_SECRET` – bilo koji string (min. 16 znakova), npr. nasumična lozinka
- Ako baza nije automatski povezana: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (ili koristi DO “Attach Database” da DO ubaci varijable)

## 5. Nakon deploya

- Otvori **app.studiotaf.xyz** — treba da vidiš Fluxa (login), ne sample React.
- Ako build padne, u DO pogledaj **Build** log (ne samo Runtime).
