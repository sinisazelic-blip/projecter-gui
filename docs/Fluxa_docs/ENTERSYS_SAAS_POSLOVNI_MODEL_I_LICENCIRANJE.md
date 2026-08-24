# EnterSYS SaaS Poslovni Model, Master-Child Arhitektura i Licenciranje

Domaća i arhitektonska dokumentacija za upravljanje EnterSYS SaaS pretplatama, pravnim licima, Master/Child federacijom i nivoima pristupa.

---

## 1. Poslovni Model i Pravna Struktura

### 1.1 Razdvajanje Autoriteta (Studio TAF) i Operativnog Preduzeća
1. **Studio TAF (Siniša Zelić / Superadmin)**:
   - Kontroliše vlasnički i tehnički nivo Fluxe (**Master Core**).
   - Studio TAF ne izdaje fakture krajnjim kupcima EnterSYS-a i ne bavi se operativnom naplatom SaaS/HaaS pretplata.
   - Studio TAF **isključivo kontroliše**:
     - Registraciju i odobravanje novih tenanata/kupaca.
     - Generisanje i dodjeljivanje licencnih tokena.
     - Master suspenziju / trajno oduzimanje pristupa (Kill-Switch).

2. **Novo Preduzeće (EnterSYS Operativa)**:
   - Posebno pravno lice sa svojom upravom, direktorom, prodajnim i računovodstvenim timom.
   - Koristi sopstvenu Fluxa instancu/tenant modifikovanu za njihov poslovni model (SaaS + HaaS fakturisanje, knjigovodstvo, prskanje uplata).
   - Ima pravo operativnog produžavanja datuma isteka licence nakon evidentirane uplate i prilagođavanja zakupljenih modula u okviru odobrenih okvira.

---

## 2. Arhitektura Federacije (Master-Child Hierarchy)

Sistem licenciranja u bazi podataka (`tenants` tabela) podržava roditeljsko-child povezivanje preko kolone **`soccs_federation_parent_tenant_id`**:

- **Master Tenant (Studio TAF)**:
  - Nadređeni tenant (Parent ID = null / Owner).
  - Posjeduje ekskluzivna prava za upravljanje strukturom tenanata i licencnim tokenima.
- **Child Tenant (EnterSYS Operativno Preduzeće)**:
  - Operativni tenant čije računovodstvo i prodaja vode zaduženja i fakturisanje krajnjih klijenata.
  - Onemogućeno je samostalno kreiranje Master tenanata ili mijenjanje sigurnosnih ključeva bez Master verifikacije.

---

## 3. Developer Uloga: "Kasica" (PURS Fiskalizacija Middleware)

Za eksterne developere (npr. autora Kasica aplikacije koja komunicira sa PURS fiskalnim uređajima i ERP-om):

### 3.1 Nivo Prava i Sigurnosne Restrikcije
- **Uloga u bazi (`roles`)**: `Kasica` (`role_id: 10`, `nivo_ovlascenja: 1`).
- **Pristup aplikaciji**:
  - Korisnik sa ulogom **Kasica** je u potpunosti zaključan u **Read-Only** režimu.
  - Prilikom prijave, automatski se preusmjerava na `/studio/licence?tab=ENTERSYS`.
  - Blokiran mu je pristup svim ostalim modulima (fakture, banka, troškovi, projekti, šifarnici).

### 3.2 Šta uloga "Kasica" VIĐA (Vidljivi podaci):
- Naziv zakupca / tenanta (npr. *JP Aquana Banja Luka*)
- Kontekst objekta (npr. *BAZEN*)
- Broj zakupljenih prodajnih instanci / blagajni (`broj_blagajni`, npr. *2 blagajne*)
- Zakupljeni tier/paket (npr. *ENTERPRISE*)
- Status licence, datum isteka i preostali dani (`subscription_ends_at`, `days_until_end`)

### 3.3 Šta je ulogu "Kasica" STROGO SKRIVENO (Zaštićeni podaci):
- **Cijene pretplata i financijski uslovi**: Cijene (`monthly_price`, `currency`) se na serveru u API-ju `/api/tenant-admin/tenants` zamjenjuju sa `null` i uopće se ne šalju mrežom.
- **Kolona Cijena u UI-ju**: U potpunosti sakrivena iz tabele.
- **Kontakti za fakturisanje**: Skriveni (`billing_email`, `billing_phone`).
- **Akcije**: Sva dugmad za izmjenu, produženje ili brisanje su sakrivena, a API rute za PATCH/POST vraćaju HTTP 403.

---

## 4. Dodata Polja u Bazi i UI-ju

- **`tenants.broj_blagajni`** (`INT NOT NULL DEFAULT 1`): Evidentira broj prodajnih instanci/blagajni za koje klijent ima licencu (npr. GOB = 1 blagajna, Vodeni park = 1 blagajna, ukupno 2).
- **Prikaz u Argus Footeru**: U donjoj liniji Argus UI-ja prikazuje se:
  > `Licenca: Enterprise SaaS - JP Aquana Banja Luka (2 blagajne) (Preostalo 138 dana)`
