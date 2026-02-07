# proJECTer – DB mapa (DigitalOcean MySQL: studio_db)

> Napomena: Ovo je mapa relacija kako smo je definisali u razgovoru i kroz kreirane tabele.
> Ako želiš 100% verifikaciju, za svaku tabelu pokreni:
> `SHOW CREATE TABLE <tabela>;`

## Core entiteti
### klijenti
- PK: klijent_id
- naziv_klijenta
- tip_klijenta (direktni/agencija) ili boolean (zavisno kako si postavio)
- dodatni podaci (adresa, PIB/VAT/WAT, valuta plaćanja, valuta_dana, napomena...)

Relacije:
- klijenti (1) -> (N) projekti
- klijenti (1) -> (N) fakture (bill_to_klijent_id)
- klijenti (1) -> (N) klijenti_pocetno_stanje

### projekti
- PK: projekat_id
- FK: klijent_id -> klijenti.klijent_id
- naziv_projekta (radni)
- created_at (datum/vrijeme otvaranja)
- status_id ili status (zavisno kako je urađeno)
- rokovi (rok_glavni/event_kraj su “čistili” u importu — logika zavisi od finalne kolone)
- finansije: planirani_budzet, planirana_zarada (ako postoji), itd.

Relacije:
- projekti (1) -> (N) projektni_troskovi
- projekti (1) -> (N) faktura_stavke / projekti_fakture (ako imaš taj sloj)
- projekti (N) -> (1) klijenti

### account_menadzeri (ako postoji)
- PK: account_id
- FK: klijent_id (agencija) -> klijenti.klijent_id
- ime/prezime, kontakt

Relacije:
- account_menadzeri (N) -> (1) klijenti (agencija)
- projekti opcionalno imaju account_id samo ako je agencija

## Troškovi (projektni / varijabilni)
### trosak_tipovi
- PK: tip_id
- naziv, kategorija (talent, dobavljac, muzika, ostalo...)
- aktivan

Relacije:
- trosak_tipovi (1) -> (N) projektni_troskovi

### kursna_lista
- PK: (valuta, datum) ili kurs_id (zavisno kako je napravljeno)
- valuta: EUR/USD/...
- kurs_u_km
- datum

Relacije:
- kursna_lista koristi se za preračun u projektni_troskovi iznos_km

### projektni_troskovi
- PK: trosak_id (ili BIGINT)
- FK: projekat_id -> projekti.projekat_id
- FK: tip_id -> trosak_tipovi.tip_id
- opcioni FK:
  - talent_id -> talenti.talent_id (ako je tip talent)
  - dobavljac_id -> dobavljaci.dobavljac_id (ako je tip dobavljač)
- datum_nastanka (BITNO: stvarni datum troška)
- iznos (u izvornoj valuti)
- valuta (KM/EUR/USD…)
- kurs_u_km (popunjava se iz kursne_liste ili fiksno za EUR)
- iznos_km (izračunati iznos)
- status (CEKA/PLACENO/DJELIMICNO) ili polja za saldo

Relacije:
- projekti (1) -> (N) projektni_troskovi
- projektni_troskovi (1) -> (N) placanja_stavke

## Plaćanja troškova (isplate / dobavljači / talenti)
### placanja
- PK: placanje_id (BIGINT)
- datum_placanja
- iznos_km ukupno
- nacin (banka/keš)
- napomena

Relacije:
- placanja (1) -> (N) placanja_stavke

### placanja_stavke
- PK: stavka_id
- FK: placanje_id -> placanja.placanje_id
- FK: trosak_id -> projektni_troskovi.trosak_id
- iznos_km (koliko od uplate ide na taj trošak)
- UNIQUE(placanje_id, trosak_id)

Relacije:
- placanja (1) -> (N) placanja_stavke
- projektni_troskovi (1) -> (N) placanja_stavke

## Fiksni troškovi (pretplate, zakupi, porezi…)
### fiksni_troskovi
- PK: trosak_id (vidjeli smo da je `trosak_id` auto_increment)
- naziv_troska
- frekvencija ENUM: MJESECNO/GODISNJE/JEDNOKRATNO
- dan_u_mjesecu (za mjesečne)
- datum_dospijeca (za godišnje/jednokratne)
- zadnje_placeno (DATE)
- rok_tolerancije_dana (INT)
- iznos (DECIMAL) **ne smije biti NULL** (za “neaktivne” stavi 0.00 ili aktivan=0)
- valuta (KM/EUR/USD)
- nacin_placanja
- automatski (0/1)
- aktivan (0/1)
- napomena

View/procedure (po potrebi):
- vw_fiksni_troskovi_raspored (status CEKA/KASNI/PLACENO)
- sp_osvjezi_status_troskova (ako je koristiš)

## Fakture + fiskalno
### fakture
- PK: faktura_id
- FK: bill_to_klijent_id -> klijenti.klijent_id
- godina, broj_u_godini (reset svake godine)
- broj_fiskalni (kontinuiran, ne resetuje)
- datum_izdavanja
- tip: obicna/prosirena/multi
- valuta: BAM/EUR/USD (u GUI prikazuj KM)
- kurs_u_bam/kurs_u_km (ako treba)
- napomena

Relacije:
- klijenti (1) -> (N) fakture
- fakture (1) -> (N) uplate (ako uplate vezuješ na fakturu)

### uplate (ako postoji)
- PK: uplata_id
- FK: faktura_id -> fakture.faktura_id
- datum_uplate
- iznos, valuta, iznos_km
- napomena

### brojac_faktura (ako postoji)
- godina
- zadnji_broj_u_godini

### fiskalni_dogadjaji (ako postoji)
- PK: dogadjaj_id
- faktura_id NULL (storno ili evidencija može imati posebnu logiku)
- tip: DODJELA / STORNO / KOPIJA / PRESKOK
- broj_fiskalni
- napomena
- created_at

## Talenti (operativno + početno stanje)
### talenti
- PK: talent_id
- naziv/ime, kontakt, napomena, aktivan

### talent_pocetno_stanje
- PK: (talent_id) ili stanje_id
- FK: talent_id -> talenti.talent_id
- iznos_duga_km
- napomena

Operativne tabele koje si importovao:
- talenti_angazmani
- talenti_isplate
(veze su preko talent_id i/ili projekat_id)

## Dobavljači (operativno + istorija)
### dobavljaci
- PK: dobavljac_id
- naziv, vrsta, pravno_lice, drzava_iso2, grad, adresa...
- aktivan

### dobavljac_istorija
- PK: istorija_id
- godina
- FK: dobavljac_id -> dobavljaci.dobavljac_id
- FK: krajnji_klijent_id -> klijenti.klijent_id (nullable)
- broj_projekata, iznos_ukupno, napomena

Napomena:
- Nazive FK constrainta držati jedinstvenim (imali smo konflikt sa fk_di_dobavljac ranije).
