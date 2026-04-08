# Setup projekta na novom laptopu (OneDrive + Cursor)

Kratki redoslijed da sve na drugom laptopu radi kao na starom.

---

## 1. Šta već imaš

- **OneDrive** – folder s projektom će se sinkronizovati (npr. `Desktop\FLUXA`).
- **MySQL** – baza; provjeri da servis radi i da imaš pristup (isti korisnik/lozinka kao na starom laptopu ako koristiš lokalnu bazu).
- **Visual Studio Code** – nije obavezno ako radiš samo u Cursoru; Cursor je dovoljan za ovaj projekat.

---

## 2. Šta instalirati (redom)

### 2.1 Git (ako ga nema)

- Preuzmi: https://git-scm.com/download/win  
- Instaliraj s default opcijama (PATH, itd.).  
- Potrebno za verzionisanje i da Cursor može koristiti Git.

### 2.2 Node.js (LTS)

- Preuzmi: https://nodejs.org (LTS verzija).  
- Instaliraj; uključi „Add to PATH” ako pita.  
- U terminalu provjeri: `node -v` i `npm -v`.

### 2.3 Cursor

- Preuzmi: https://cursor.com  
- Instaliraj i uloguj se (account ako ga koristiš).

---

## 3. Nakon instalacije Cursora – ekstenzije („podprogrami”)

Cursor koristi isti sistem ekstenzija kao VS Code. Otvori Cursor, pa:

1. **Ctrl+Shift+X** (ili View → Extensions).
2. Pretraži i **instaliraj** (Install):

| Ekstenzija | Šta daje |
|------------|----------|
| **Tailwind CSS IntelliSense** | Autocomplete i pregled Tailwind klasa u kodu (autor: Tailwind Labs) |
| **ESLint** | Prikaz lint grešaka u fajlovima (autor: Microsoft) – opciono ako koristiš ESLint |
| **GitLens** (opciono) | Historija i blame u kodu – korisno za Git |

Ako ne vidiš neku ekstenziju, u Cursoru obično radi VS Code marketplace; ako tražiš po imenu, npr. „Tailwind” i „ESLint”, naći ćeš ih.

**Napomena:** Projekt koristi **Biome** za lint (`npm run lint`), ne nužno ESLint. ESLint ekstenzija može pomoći ako dodaješ ESLint kasnije; inače je opciona.

---

## 4. Projekt na novom laptopu

1. **Čekaj OneDrive** da završi sync projekta (folder `FLUXA`).
2. **Otvori projekt u Cursoru:** File → Open Folder → izaberi `FLUXA` (iz OneDrive foldera).
3. **Varijable okruženja:**  
   Na starom laptopu u rootu projekta imaš `.env.local` (baza, itd.). Na novom laptopu:
   - Ili **kopiraj** `.env.local` s starog laptopa (USB, mail, OneDrive – pazi da ne commituješ ga u Git),  
   - Ili **napravi novi** `.env.local` u rootu projekta s istim varijablama (npr. `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).  
   Bez ispravnog `.env.local` aplikacija neće moći da se poveže na bazu.
4. **Instalacija paketa:** U Cursoru otvori terminal (Ctrl+` ili View → Terminal) i u rootu projekta pokreni:
   ```bash
   npm install
   ```
5. **Pokretanje:**
   ```bash
   npm run dev
   ```
   Otvori browser na adresi koju ispiše (npr. http://localhost:3000).

---

## 5. Brza provjera

- [ ] `node -v` i `npm -v` rade u terminalu  
- [ ] `git --version` radi  
- [ ] MySQL servis je pokrenut  
- [ ] `.env.local` postoji u rootu projekta (ili si ga kopirao)  
- [ ] `npm install` prošao bez greške  
- [ ] `npm run dev` pokrene app, stranica se učitava u browseru  

Ako sve ovo vrijedi, možeš normalno nastaviti rad na ovom laptopu. Kad sutra pošalješ pripremu za user management, uporedit ću je sa stanjem u bazi i javit ću ako treba još pojašnjenja – a implementaciju user managementa radimo tek nakon fiskalizacije, kako smo dogovorili.
