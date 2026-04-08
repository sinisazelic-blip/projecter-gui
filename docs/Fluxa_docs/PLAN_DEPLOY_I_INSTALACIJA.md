# Plan: Postavljanje Fluxe na DO host i instalaciona verzija za druge studije

*Koraci koje treba uraditi kad je sve ostalo gotovo (demo baza, ESIR, itd.).*

---

## 0. Priprema prije upload-a na DO

**Svrha:** Šta ti treba pripremiti **prije** samog upload-a i dizanja aplikacije. Upload na DO radiš ti, uz pomoć; ova lista osigurava da sve imaš spremno i da znaš na koji način šta pripremiti.

### 0.1 Šta uopšte treba imati spremno

- [ ] **Pristup DO serveru** — SSH (ključ ili lozinka), korisnik (npr. root ili sudo user).
- [ ] **Pristup MySQL na DO** — host, port, korisnik, lozinka. (Ako koristiš Managed Database, ovo dobijaš iz DO kontrolne table; port je često 25060.)
- [ ] **Kod aplikacije** — pripremljen za upload (v. 0.2); bez `node_modules`, bez `.next`, bez `.env.local` sa tvojim tajnama.
- [ ] **Spisak env varijabli** — koje ćeš na serveru popuniti (v. odjeljak 1.3 u ovom dokumentu i root README.md).
- [ ] **SQL za praznu bazu** — ako postavljaš novu bazu (novi tenant / novi klijent): schema skripte i redoslijed izvršavanja (v. 0.3).
- [ ] **Licenca za tenant-a** — ako je instanca „klijentska” (tenant): URL i token za provjeru licence (v. 0.5).
- [ ] **Domena / subdomena** — za koju će ta instanca odgovarati (nginx vhost), npr. `fluxa.taf.ba` ili `klijent.fluxa.ba`.

### 0.2 Na koji način pripremiti kod za upload

- **Šta uploadovati:** Cijeli folder projekta (repo) **bez** sljedećeg:
  - `node_modules/` (na serveru ćeš pokrenuti `npm ci`)
  - `.next/` (na serveru ćeš pokrenuti `npm run build`)
  - `.env.local` i bilo koji `.env*` sa stvarnim tajnama (na serveru kreiraš novi .env sa produkcijskim vrijednostima)
  - Opciono isključiti: `data/`, privremene fajlove, velike logove ako ih ima
- **Način:**  
  - **Opcija A:** Na serveru `git clone` (ako je repo dostupan s tog servera), pa `npm ci` i `npm run build`.  
  - **Opcija B:** Lokalno napraviš zip arhivu projekta (bez navedenih foldera/fajlova), uploaduješ na server (npr. scp, SFTP, ili upload kroz DO panel), pa na serveru raspakuješ, zatim `npm ci` i `npm run build`.
- **Šta ne smije u arhivu/repo:** Stvarne lozinke, AUTH_SECRET, DB lozinke, LICENCE_TOKEN — to se na serveru unosi ručno u `.env.local` ili `.env.production`.

### 0.3 Šta treba za postavljanje prazne baze (novi tenant / novi klijent)

Kad za novog tenant-a (novog klijenta) postavljaš **novu**, praznu bazu:

1. **Schema (struktura) baze**
   - Imam **jedan SQL fajl** koji kreira sve tabele (npr. `fluxa_new.sql` — export „structure only” iz postojeće baze), **ili**
   - Imam **više skripti** u folderu `scripts/` (create-*.sql, alter-*.sql) koje moraju biti pokrenute u **točno definisanom redoslijedu**. Redoslijed treba zapisati (npr. u ovom dokumentu ili u LISTA_DO_GO_LIVE) da prije upload-a znaš koji script prvi, koji drugi.
2. **Seed (opciono)**  
   - Ako aplikacija očekuje minimalne podatke (npr. uloge u `roles`, jedan admin korisnik u `users`), pripremi seed skriptu ili upute kako to ubaciti. U repou postoje npr. `scripts/seed-demo.js`, `scripts/seed-roles-from-excel.sql` — za produkcijsku praznu bazu koristiš ono što odgovara (bez demo podataka ako ne treba).
3. **Na DO**  
   - Kreiraš novu praznu bazu (npr. `fluxa_klijent_x`) i MySQL korisnika s pravom pristupa toj bazi.  
   - Zatim na toj bazi pokrećeš schema (i po potrebi seed). Način: MySQL Workbench, ili `mysql -h ... -u ... -p ... < fluxa_new.sql` sa servera ili s lokalnog računara ako imaš pristup.

**Prije upload-a:** Napiši si listu: (1) koji SQL fajl ili koje skripte, (2) redoslijed, (3) da li treba seed i koji. Kad kreneš upload, imat ćeš sve na jednom mjestu.

### 0.4 Novi hosting za tenant-a — šta pripremiti

Za **svakog novog tenant-a** (novi klijent na istom ili drugom hostingu) trebaš pripremiti:

| Šta | Na koji način |
|-----|----------------|
| **Nova baza** | Na DO: kreirati bazu + korisnika; pokrenuti schema (+ seed) kao u 0.3. |
| **Novi .env za tu instancu** | Kopija .env predloška; popuniti `DB_NAME=` ime nove baze, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`, `AUTH_SECRET` (nova, jaka vrijednost samo za tu instancu). Za tenant instancu dodati i `LICENCE_CHECK_URL` + `LICENCE_TOKEN` (v. 0.5). |
| **Kod / build** | Isti kod kao za drugu instancu; build (`npm run build`) može biti jedan te isti, razlikuje se samo .env. |
| **PM2 proces** | Novi proces (npr. drugi port, npr. 3001) sa env varijablama koje pokazuju na novu bazu i novi APP_URL. |
| **Nginx vhost** | Nova subdomena ili domena (npr. `klijent.fluxa.ba`) koja proxy-uje na port te instance (npr. 3001). SSL (HTTPS) preporučeno. |
| **Licenca** | Za tu instancu unijeti `LICENCE_CHECK_URL` i `LICENCE_TOKEN` da aplikacija može provjeravati stanje licence (v. 0.5). |

Ako sve ovo imaš na listi prije nego kreneš, sam upload i podešavanje idu brzo.

### 0.5 Postavljanje licence (za tenant instancu)

Fluxa podržava **provjeru licence** na klijentskim instancama: aplikacija periodički zove „master” API s tokenom; ako master vrati `allowed: false`, korisnik vidi blokiranu stranicu (obratite se administratoru Fluxe).

- **Master instanca (tvoja glavna / admin)**  
  Na njoj **ne** postavljaš `LICENCE_CHECK_URL` ni `LICENCE_TOKEN`. Provjera se preskače; sve radi normalno.
- **Tenant / klijentska instanca**  
  Na njoj **moraš** postaviti u .env:
  - **`LICENCE_CHECK_URL`** — puni URL do API-ja za provjeru licence (npr. `https://tvoj-master.fluxa.ba/api/public/licence-check` ili kako je na tvom masteru implementirano). Aplikacija šalje GET zahtjev s headerom `Authorization: Bearer <LICENCE_TOKEN>`.
  - **`LICENCE_TOKEN`** — token koji master očekuje za tog tenanta. Taj token ti (kao administrator) generišeš ili dodjeljuješ za tog klijenta; na masteru ga upisuješ u bazu ili konfiguraciju da API zna da je tenant aktivan.

**Šta pripremiti prije upload-a za novog tenanta:**  
- Odluka gdje će biti master API (koja domena, koji endpoint).  
- Za tog tenanta: jedinstveni **LICENCE_TOKEN** (npr. generišeš ga jednom i čuvaš u sigurnom mjestu).  
- Na serveru tenant instance u .env upisuješ `LICENCE_CHECK_URL` i `LICENCE_TOKEN`; aplikacija će sama zvati master i prikazivati blokadu ako licence nema.

Detalji implementacije master API-ja (kako spremaš tokene, kako vraćaš `allowed`/`reason`) mogu biti u posebnom tehničkom uputu; ovdje je važno da znaš **šta treba pripremiti** (URL + token) za postavljanje licence na tenant instanci.

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
   cd /path/to/FLUXA
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
   - Kreirati MySQL bazu i korisnika; pokrenuti migracije (tabele) – skripte iz `scripts/` (npr. create-*.sql, alter-*.sql) u ispravnom redoslijedu, pa po potrebi seed (roles, prvi admin user). V. i **DEMO_BAZA_I_PRIKAZ.md** (u ovom folderu) za demo bazu.

### 1.3 Varijable okruženja (primjer)

Aplikacija čita bazu i auth iz **pojedinačnih** varijabli (v. `src/lib/db.ts`, `src/lib/auth/session.ts`). Na serveru koristi `.env.local` ili `.env.production`.

**Obavezne:**
- `DB_HOST` — MySQL host
- `DB_USER` — MySQL korisnik
- `DB_PASSWORD` — MySQL lozinka
- `DB_NAME` — Ime baze
- `DB_PORT` — Port (opciono; default 3306; na DO često 25060)
- `AUTH_SECRET` ili `SESSION_SECRET` — tajna za session cookie, min. 16 znakova (bez nje login vraća grešku)

**Opciono / po potrebi:**
- `UPLOAD_PATH` — folder za upload logotipa (default: `public/logos`)
- `APP_URL` / `NEXT_PUBLIC_APP_URL` — bazni URL aplikacije
- `FLUXA_OWNER_TOKEN` — token za owner pristup (Blagajna, owner-login)
- `ENABLE_TENANT_ADMIN`, `NEXT_PUBLIC_ENABLE_TENANT_ADMIN`, `DEFAULT_TENANT_ID` — tenant admin
- `LICENCE_CHECK_URL`, `LICENCE_TOKEN` — provjera licence
- Ako koristiš ESIR/fiskal: URL i credentials prema dokumentaciji (fiskal)
- Za produkciju: ne koristiti development secrets; koristiti jake vrijednosti za AUTH_SECRET.

Puni spisak varijabli i kratko objašnjenje nalazi se u **korijenskom README.md** (sekcija „Varijable okruženja”).

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
→ **Urađeno:** `scripts/seed-demo.js` + `scripts/import-demo-db.ps1` (struktura), v. **DEMO_BAZA_I_PRIKAZ.md** (u ovom folderu).

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
