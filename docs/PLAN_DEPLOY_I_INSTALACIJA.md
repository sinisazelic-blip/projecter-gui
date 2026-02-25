# Plan: Postavljanje Fluxe na DO host i instalaciona verzija za druge studije

*Koraci koje treba uraditi kad je sve ostalo gotovo (demo baza, ESIR, itd.).*

---

## 1. Postavljanje Fluxe na DO host (tvoj produkcijski okruženje)

**Stanje:** Folder na DO hostu je već pripremljen; treba uploadovati aplikaciju i pokrenuti je.

### 1.1 Šta treba obezbijediti na serveru (DO)

- [ ] **Node.js** (LTS, npr. 20.x) – za build i run Next.js
- [ ] **npm** ili **pnpm** – za instalaciju dependencija
- [ ] **MySQL** (ili MariaDB) – baza podataka; pristup (host, user, pass, database name)
- [ ] **.env** varijable – vidi 1.3
- [ ] **PM2** ili **systemd** (opciono) – da aplikacija radi u pozadini i nakon restarta servera

### 1.2 Koraci za upload i pokretanje

1. **Upload koda**
   - Na način koji koristiš: git clone na serveru (ako je repo dostupan), ili upload arhive (zip) u pripremljeni folder, pa raspakovanje.
   - Isključi iz uploada: `node_modules`, `.next`, `.env.local` (lokalne vrijednosti), eventualno `data/` ako nije za produkciju.

2. **Instalacija i build**
   ```bash
   cd /path/to/projecter-gui
   npm ci
   npm run build
   ```

3. **Konfiguracija**
   - Kreirati na serveru `.env.local` (ili `.env.production`) sa pravim vrijednostima za produkciju (baza, eventualno ESIR URL/ključevi, itd.).

4. **Pokretanje**
   - Development (privremeno): `npm run dev`
   - Produkcija: `npm run start` (ili preko PM2: `pm2 start npm --name fluxa -- start`)

5. **Web server (nginx / reverse proxy)**
   - Ako Fluxa radi na portu 3000, nginx (ili drugi reverse proxy) treba da prima zahtjeve na domenu i proslijedi na localhost:3000; SSL (HTTPS) preporučeno.

6. **Baza na DO**
   - Kreirati MySQL bazu i korisnika; pokrenuti migracije (tabele) – npr. skripte iz `scripts-RedDellvill/`, pa po potrebi seed (roles, prvi admin user).

### 1.3 Varijable okruženja (primjer)

- `DATABASE_URL` ili pojedinačno: host, user, password, database (kako tvoj kod očekuje)
- Ako koristiš ESIR: URL, credentials (kako dokumentacija traži)
- Ako koristiš owner token (Blagajna itd.): `FLUXA_OWNER_TOKEN` ili sl.
- Za produkciju: ne koristiti development secrets.

---

## 2. Tko šta dobija (model isporuke)

- **Instalacioni paket** (kod, SQL skripte, .env primjer, tehničko uputstvo) koristi **samo naša strana** – da mi brzo i isto postavimo Fluxu za svakog novog klijenta na njihov ili naš host.
- **Klijent (studio/agencija)** dobija **samo gotov proizvod**: pristup aplikaciji na svojoj domeni (ili subdomeni) + **korisničku dokumentaciju** (uputstvo za rad u Fluxi). Klijent **ne dobija** kod, SQL, .env, niti tehničku dokumentaciju; ne „igra se” našim kodom.
- Održavanje i sve tehničke izmjene ostaju kod nas; mi smo vlasnici i jedini nosioci prava na tehničke promjene.

---

## 3. Instalaciona verzija za druge studije (paket za nas)

**Cilj:** Mi imamo jedan „paket” (kod + skripte + uputstvo) pomoću kojeg **mi** za svakog novog klijenta postavimo Fluxu – klijent ne instalira sam, mi to radimo za njih.

### 3.1 Šta „instalaciona verzija” treba da sadrži

- [ ] **Kod aplikacije** – npr. arhiva (zip) ili git repo (javni ili privatan) bez tvojih env i bez produkcijske baze.
- [ ] **SQL skripte za praznu bazu:**
  - Kreiranje svih tabela (schema) – jedan glavni skript ili više manjih (npr. `create-shifarnici`, `create-projekat-faze`, `fix-users-table`, itd.) u ispravnom redoslijedu.
  - Opciono: **seed** samo ono što je potrebno da aplikacija radi (npr. uloge u `roles`, jedan admin user u `users`, radne faze ako su obavezne).
- [ ] **.env primjer** – npr. `.env.example` sa svim potrebnim varijablama (bez stvarnih vrijednosti), sa kratkim objašnjenjem.
- [ ] **Kratko tehničko uputstvo** za nas (redoslijed skripti, env, pokretanje) – vidi 3.2.

### 3.2 Koraci koje mi radimo pri postavljanju za novog klijenta

1. Kreirati na serveru novu bazu (ili koristiti već pripremljene – vidi odjeljak 4).
2. Pokrenuti SQL skripte (schema + seed) na tu bazu.
3. Za tog klijenta: nova kopija koda ili isti build sa drugim `.env` (drugi DATABASE_URL).
4. Pokrenuti aplikaciju (novi PM2 proces ili drugi port), nginx usmjeriti subdomenu/domenu na nju.
5. Predati klijentu pristup (URL, prvi login) i korisničku dokumentaciju.

### 3.3 Šta obezbijediti u paketu (za nas)

- **Dokumentacija**
  - Lista SQL skripti u točnom redoslijedu (koji script prvo, koji poslije).
  - Opis svake env varijable (šta je obavezno, šta opciono).
  - Minimalni hardware/OS preduvjeti (npr. Node 20+, MySQL 8+).
- **Schema bez tvojih podataka**
  - Skripte koje kreiraju samo tabele (i po želji minimalan seed: roles, jedan admin). Bez exporta tvoje produkcijske baze.
- **Verzija koda**
  - Odlučiti: git tag (npr. `v1.0-install`) ili arhiva; naznačiti u uputstvu koju verziju koristiti.
- **Podrška**
  - Na koga da novi korisnik piše ako nešto zapne (email, kontakt) – opciono, ali korisno.

---

## 4. Jedan DO server, više baza (više klijenata)

Na istom DO serveru možeš imati **jedan MySQL** sa **više baza** (npr. fluxa_studio_taf, fluxa_klijent_a, fluxa_klijent_b) i **više instanci aplikacije** – isti build, svaka sa drugim .env (drugi DATABASE_URL). Nginx usmjerava subdomenu na odgovarajući port. Resize dropleta ako treba više RAM-a/diska. Za novog klijenta: kreirati bazu, migracije/seed, novi .env, nova PM2 instanca, nginx vhost – trajanje minuta do nekoliko minuta. Opciono: unaprijed pripremljene prazne baze (slotovi).

---

## 5. Demo baza (fluxa_demo) – urađeno

**Cilj:** Posebna baza za demo (Guest) bez pristupa pravim TAF podacima. Ista struktura = podloga za buduće klijentske baze.

**Šta je urađeno:**
1. **Export strukture** iz Studio TAF baze (na DO Managed Database) – samo struktura, bez podataka.
   - Alat: MySQL Workbench → Server → Data Export → odabrana TAF baza → Dump Structure Only → export u **fluxa_new.sql**.
   - Fajl: `fluxa_new.sql` (npr. u `mysql tools\Stukture_NEW\`). Čuvati kao glavni šablon za sve nove baze.
2. **Nova baza** na DO: kreirana prazna baza **fluxa_demo**.
3. **Import strukture** u fluxa_demo: u MySQL Workbenchu otvoren fluxa_new.sql, postavljena baza fluxa_demo, pokrenut import. fluxa_demo sada ima identičnu strukturu kao TAF (tabele, view-ovi), bez podataka.

**Za buduće klijente (fluxa_client01, 02, …):** Kreirati novu praznu bazu na DO, zatim importovati isti **fluxa_new.sql** u nju – isti postupak kao za fluxa_demo.

**Opciono kasnije:** Seed skripta sa lažnim podacima da demo izgleda „živo“ (par klijenata, projekata, jedna faktura).  
→ **Urađeno:** `scripts/seed-demo.js` + `scripts/import-demo-db.ps1` (struktura), v. `docs/DEMO_BAZA_I_PRIKAZ.md`.

**Upload studio baze na server:** Kad budemo radili deploy/upload studio baze, uključujemo i **postavu studio_db_demo**: ista struktura (import skriptom), pa seed. **Gosti** koji žele da vide kako Fluxa funkcioniše vide samo tu demo bazu – demo instanca aplikacije ima `DB_NAME=studio_db_demo`, bez pristupa pravim podacima.

---

## 6. Redoslijed kad je „sve gotovo”

1. Završiti guest login i link na demo (prema PLAN_AUTH_ROLES).
2. Završiti ESIR integraciju (kad stigne dokumentacija).
3. Testirati lokalno / na test okruženju da sve radi.
4. **DO host:** Uraditi korake iz odjeljka 1 (upload, env, build, start, baza, nginx).
5. **Instalacioni paket (za nas):** Pripremiti kod + SQL u redoslijedu + .env.example + kratko tehničko uputstvo za nas; testirati jednom na čistoj bazi (lokalno ili na DO).
6. **Korisnička dokumentacija:** Uputstvo za rad u Fluxi (bez tehničkih detalja), za predaju klijentima.
7. Ažurirati ovaj dokument sa stvarnim putanjama, imenima skripti i linkovima (DO, repo).

*(Odjeljak 5: Demo baza – šta je urađeno; odjeljak 7: U koji .env upisati bazu za demo.)*

---

## 7. U koji .env upisati bazu za demo (tačka 1)

Aplikacija čita bazu iz varijabli okruženja: **DB_HOST**, **DB_USER**, **DB_PASSWORD**, **DB_NAME** (vidi `src/lib/db.ts`). Koji fajl se koristi ovisi o tome **kako pokrećeš** aplikaciju:

- **Lokalno (development):** Next.js učitava `.env.local` iz root foldera projekta. Ako lokalno testiraš demo, u `.env.local` staviš `DB_NAME=fluxa_demo` (ostalo isto kao za TAF).
- **Na DO serveru – glavna aplikacija (Studio TAF):** Ona mora koristiti TAF bazu. Znači u env-u za tu instancu: `DB_NAME=` ime tvoje TAF baze (npr. `defaultdb` ili kako god se zove).
- **Na DO serveru – demo aplikacija (npr. demo.fluxa.ba):** Ta instanca mora koristiti **fluxa_demo**. Znači upisuješ u **onaj .env koji ta demo instanca učitava** kad se pokrene:
  - Ako imaš **poseban folder** za demo (npr. `/var/www/fluxa-demo/`), tamo staviš `.env.production` ili `.env.local` sa `DB_NAME=fluxa_demo` (host, user, password ostaju isti kao za DO bazu).
  - Ako koristiš **PM2** sa dva procesa (jedan za TAF, jedan za demo), u konfiguraciji za demo proces staviš env: `DB_NAME=fluxa_demo`. Npr. u `ecosystem.config.js`: drugi app sa `env: { DB_NAME: 'fluxa_demo' }`.
  - Ako na serveru postoji samo jedan folder s aplikacijom, a dva različita načina pokretanja (npr. dva PM2 procesa), onda **nemaš jedan fajl .env** – već za svaki proces u PM2-u (ili systemd) navodiš varijable; za demo proces navedeš `DB_NAME=fluxa_demo`.

**Ukratko:** U **onaj .env (ili env konfiguraciju) koji se učitava kad se pokrene demo verzija aplikacije** – tu treba `DB_NAME=fluxa_demo`. Za TAF verziju u njenom env-u ostaje ime TAF baze.

---

## 8. Napomene

- **Lozinke i tajne:** U .env.example nikad stvarne vrijednosti; u uputstvu naglasiti da korisnik mora postaviti svoje.
- **Licenca / ugovor:** Ako Fluxa ide drugim studijima kao proizvod, odvojeno definirati licencu ili ugovor; ovaj dokument je samo tehnički plan instalacije i deploya.
- **Backup:** Za DO produkciju definirati redovni backup baze i eventualno koda (npr. cron + mysqldump).

Kad budeš krenuo s postavljanjem na DO ili s pakovanjem instalacione verzije, možemo korak po korak proći kroz ove tačke i dopuniti ih stvarnim naredbama i putanjama iz tvog projekta.
