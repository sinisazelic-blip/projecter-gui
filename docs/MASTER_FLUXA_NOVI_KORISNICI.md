# Kako vezati novog korisnika (kupca licence) na MASTER Fluxu

Ovo objašnjenje vrijedi za **vašu instancu** Fluxe (Studio TAF) na kojoj je uključen modul **Licence** (`ENABLE_TENANT_ADMIN=true`). To je „super” / MASTER verzija u kojoj pratite sve kupce licence.

---

## Preduslov na MASTER bazi

Da bi licence check i tokeni radili, na bazi MASTER instance pokreni i **scripts/create-tenants-plans.sql** (ako već nisi) i **scripts/alter-tenants-add-licence-token.sql**. To dodaje kolonu `licence_token` u tabelu `tenants`. Za postojeće tenante (npr. Studio TAF) token možeš generisati iz Licence → 🔑 Token → „Regeneriši token”.

---

## Šta je MASTER Fluxa

- **Isti kod** kao i za klijente. Razlika je u konfiguraciji:
  - Na vašem serveru: `ENABLE_TENANT_ADMIN=true` i `NEXT_PUBLIC_ENABLE_TENANT_ADMIN=true`.
  - Na deploy-ima za kupce: ove varijable **nisu** postavljene (ili su `false`), pa modul Licence nije vidljiv.
- U MASTER Fluxi imate **Dashboard → 🔐 Licence**: lista tenanata (kupaca), produženje pretplate, promjena plana, **Novi tenant**.

---

## Kako dodati novog korisnika (novi tenant)

### 1. U MASTER Fluxi (vaša instanca)

1. Ulogujte se u Fluxu na kojoj je uključen modul Licence.
2. Otvorite **Dashboard → 🔐 Licence**.
3. Kliknite **Novi tenant**.
4. Unesite:
   - **Naziv organizacije** (npr. „Firma doo”)
   - **Plan** (Light / Full)
   - **Početak pretplate** i **Kraj pretplate** (datumi).
5. Sačuvajte.

Time ste u svojoj bazi (tabela `tenants`) upisali **novog kupca licence**. On se pojavljuje u listi tenanata; kasnije možete **Produži** i **Promijeni plan**.

### 2. Šta dalje s tim korisnikom?

- **Vi radite sve implementacije** – kupac ne dobija kod ni bazu. Svi hostinzi i baze su na vašem DO-u; vi plaćate zakup iz honorara koje naplaćujete.
- Za svakog kupca imate **zaseban deploy** Fluxe (njihov URL, njihova baza na vašem DO-u). U MASTER Fluxi **evidentirate** tenanta (naziv, plan, datume) i dobijate **licence token** koji će njihova instanca slati pri provjeri licence.
- Nakon kreiranja tenanta: u listi kliknete **🔑 Token**, kopirate token, i u **.env te klijentske instance** postavite `LICENCE_TOKEN=...` i `LICENCE_CHECK_URL=https://url-tvoje-master-fluxe/api/public/licence-check`. Od tog trenutka njihova Fluxa pri svakom učitavanju stranice pita vašu bazu da li smije raditi.

---

## Licence check – kako Suspend odmah onemogućuje rad

Sve klijentske instance hostujete vi (DO). Svaka klijentska Fluxa **nema** modul Licence i u svom **.env** ima:

- `LICENCE_CHECK_URL` = URL vaše MASTER Fluxe + `/api/public/licence-check`
- `LICENCE_TOKEN` = token tog tenanta (iz Licence → 🔑 Token)

Pri **svakom učitavanju** stranice klijentska Fluxa (server-side) poziva taj URL s headerom `Authorization: Bearer <LICENCE_TOKEN>`. MASTER baza gleda tenant po tokenu i vraća:

- `allowed: true` → korisnik vidi aplikaciju
- `allowed: false, reason: "suspended" | "expired"` → prikazuje se blok stranica („Licenca je suspendovana” / „Licenca je istekla”, kontakt Studio TAF)

Zato:

- **Kad kliknete Suspend** u Licence za tog tenanta → status u bazi postane SUSPENDOVAN → sljedeći zahtjev njihove Fluxe dobija `allowed: false` → **odmah** vide blok i ne mogu raditi. Nema potrebe ići na njihov hosting.
- **Kad istekne 365 dana** (ne produžite datum) → `subscription_ends_at` je u prošlosti → njihova Fluxa opet dobija `allowed: false` → blok dok ne produžite.

Sve kontrolišete iz MASTER konzole: produženje, Suspend, Vrati pristup, promjena plana.

---

## Sažetak

| Gdje | Šta radite |
|------|------------|
| **MASTER Fluxa** (vaša instanca) | Licence → Novi tenant, Produži, Suspend, Vrati pristup, Promijeni plan, 🔑 Token (kopiraj / regeneriši). |
| **Klijentska Fluxa** (svaki kupac, vaš DO) | U .env: `LICENCE_CHECK_URL` i `LICENCE_TOKEN`. Kod ostaje isti – nema modula Licence. |
| **Vi** | Hosting i baze na vašem DO-u; iz Licence konzole odmah možete oduzeti pristup (Suspend) ili ga vratiti (Vrati pristup). |
