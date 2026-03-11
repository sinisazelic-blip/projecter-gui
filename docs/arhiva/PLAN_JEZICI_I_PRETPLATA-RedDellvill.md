# Plan: Jezici (i18n), tržišta i pretplata (korisnici / cijene)

*Sačuvano: 23.02.2026. Rad na ovome planirano u narednom periodu.*

**Plan aktivnosti u narednom periodu** (prodaja licenci, admin tenant centar, fiskalizacija, čišćenje baze, i18n, user management, dokumentacija, itd.) v. **PLAN_AKTIVNOSTI_NAREDNI_PERIOD.md**.

---

## 1. Jezici i internacionalizacija (i18n)

### 1.1 Cilj

- **Engleska verzija** Fluxe uz postojeću srpsku.
- **Izbor jezika** u interfejsu (npr. u header-u / postavkama) – korisnik bira jezik.
- **Jedan kod** – tekstovi u fajlovima prevoda (npr. JSON po jeziku), bez dupliranja stranica.

### 1.2 Šta uvesti

| Zadatak | Opis |
|--------|------|
| **Lokal = tržište** | Izbor jezika = izbor **lokala** (BiH vs EU/international). Ne samo prevod stringova – valuta (KM vs EUR/USD), porez (PDV vs VAT), terminologija (KIF→Sales Ledger, KUF→Purchase Ledger) i sva logika ovise o lokalu. Vidi **docs/I18N_LOKAL_KAO_TRZISTE.md**. |
| Fajlovi prevoda | `locales/sr.json`, `locales/en.json` – oznake **kako se koriste u tom tržištu** (EU termini u en, BiH u sr), ne mehanički prevod. |
| Language switcher | Komponenta za izbor jezika = izbor lokala; preferenca u cookie. |
| Format i logika | Datum, broj, **valuta**, **stope poreza**, obavezna polja – po lokalu (regionu). |

### 1.3 Napomena

- **Nije dovoljno** samo zamijeniti tekst preko `t('key')` – kad je en, cijela logika (valuta, VAT, termini) mora biti EU/international. Rad **jedan prozor po jedan** (v. I18N_LOKAL_KAO_TRZISTE.md).

---

## 2. Tržišta i regionalna pravila

### 2.1 Koncept

- **Univerzalno:** Većina aplikacije (projekti, klijenti, dashboard, postavke, itd.) ostaje ista – samo jezik i format (datum, valuta) se mijenjaju.
- **Po tržištu/regionu:** Pravila i forme vezane za **poslovanje i regulativu** – svako tržište ima globalna i regionalna pravila. Ne pravimo posebne stranice po tržištu, već **konfiguraciju po regionu**.

### 2.2 Šta je specifično po tržištu

| Oblast | Šta prilagoditi |
|--------|-----------------|
| **Ponuda** | Obavezne stavke, brojevi, šabloni, eventualno obavezan tekst po zakonu |
| **Faktura** | Isto – oblike, brojeve, šablone, obavezne elemente |
| **PDV / VAT** | Stope, obaveza obračuna, izuzeća, reverse charge, itd. – po zemlji/regionu (npr. RS, EU, UK) |

### 2.3 Implementacija

- Na **tenant/organizaciju** (ili globalno po instalaciji) vezati **region / market** (npr. `RS`, `EU`, `UK`).
- **Jedan model** (ponuda, faktura, porez) + **konfiguracija po regionu**: koje stope, koja pravila, koji tekstovi.
- i18n = jezik prikaza; **market rules** = PDV i forme (logika i štampa koriste tu konfiguraciju).

### 2.4 Sledeći korak (pri implementaciji)

- Odrediti koje regione podržavamo u prvoj iteraciji (npr. **RS** + jedan **EU**).
- Za svaki region definirati: stope PDV-a, obavezne elemente ponude/fakture, šablone.

---

## 3. Korisnici i cjenovni razredi (pretplata)

### 3.1 Definicije

| Pojam | Značenje |
|-------|----------|
| **Korisnik** | Jedan registrovan nalog koji koristi Fluxu (login, rad u sistemu). |
| **Klijent (kupac Fluxe)** | Jedna firma/organizacija koja plaća pretplatu. Unutar nje može biti više **korisnika**. |
| **Limit** | Koliko korisnika ta organizacija smije imati (npr. 5, 10, 25, unlimited). Kupac to bira pri ugovoru/pretplati. |
| **Cijena** | Po broju korisnika – npr. 5 korisnika → X €/g, 10 → Y €/g (**per-seat** model). |

### 3.2 Šta implementirati

| Zadatak | Opis |
|--------|------|
| **Baza** | Za svakog tenant-a (organizaciju): `max_users` ili `plan_id` koji nosi limit (i eventualno naziv paketa). |
| **Provjera pri kreiranju korisnika** | Trenutni broj korisnika < `max_users` → dozvoli; inače odbij i prikaži poruku (npr. "Dostignut limit, nadogradite paket"). |
| **Vremenski zakup** | Polja npr. `subscription_starts_at`, `subscription_ends_at` (ili trajanje u danima). Pri loginu ili ključnim akcijama: ako `now > subscription_ends_at` → blokirati pristup ili preusmjeriti na "Produžite pretplatu". |
| **Blokada** | Provjere na **backendu** (middleware ili API); front samo prikazuje poruku i redirect. |

### 3.3 Cjenovni razredi (primjer)

- Odrediti konkretne pakete za prvu verziju, npr.:
  - 5 korisnika → cijena A
  - 10 korisnika → cijena B
  - 25 korisnika → cijena C
  - Unlimited → cijena D  

Ovo se u bazi može držati u tabeli **plans** (plan_id, naziv, max_users, cijena, valuta), a tenant ima **plan_id** ili direktno **max_users** + datum isteka.

### 3.4 Opciono kasnije

- Integracija sa payment providerom (Stripe, PayPal, itd.) – tada "godina dana" i plan mogu dolaziti od njih, aplikacija samo čita status.

---

## 4. Redoslijed rada (kad budemo implementirali)

1. **i18n** – uvesti biblioteku, fajlove prevoda (sr, en), language switcher; prebaciti UI na ključeve.
2. **Tržišta** – model regiona, konfiguracija PDV/VAT i obaveznih elemenata za ponudu/fakturu za RS (+ jedan EU ako želimo).
3. **Tenant / pretplata** – tabele (tenants, plans, subscription dates), provjera broja korisnika i datuma isteka, blokada na backendu i poruke na frontu.
4. **Cjenovni razredi** – definirati pakete (5/10/25/unlimited) i upisati u bazu; povezati sa tenantom.

---

*Kraj plana. Ažurirati ovaj dokument kako se zadaci realizuju.*
