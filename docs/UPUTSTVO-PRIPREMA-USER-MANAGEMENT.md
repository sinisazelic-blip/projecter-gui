# Upute: Šta pripremiti za User Management i prava pristupa

Kad dođe red na implementaciju korisnika, uloga i pristupa, **ti odlučuješ** kako želiš da sistem radi. Ovdje je lista stvari koje treba da nam daš ili odlučiš, da ne bismo pogađali.

---

## 1. Uloge (nivoi) – koje želiš i šta koja smije

Treba nam **lista uloga** s jasnim pravilima. Možemo koristiti ovakav predložak; ti popuniš ili prilagodiš.

| Uloga (naziv) | Nivo (broj) | Opis – šta ta uloga smije |
|---------------|-------------|---------------------------|
| **Guest** (samo pregled) | 0 | Samo ulaz u aplikaciju, **read-only** – sve vidi ali ništa ne mijenja (nema dugmad Unos, Edit, Delete, Storno, Otpis, itd.) |
| **Viewer** | 1 | Isto kao Guest ili malo više? (npr. može export u Excel?) |
| **Operator** | 2 | Unos i izmjena stavki, statusa, osnovne stvari – **bez** zatvaranja projekata, budžeta, šifarnika |
| **Manager** | 3 | + zatvaranje projekata, budžet, finansije (naplate, dugovanja, potraživanja, početna stanja?) |
| **Admin** | 4 | **Sve** – uključujući šifarnici (klijenti, dobavljači, talenti, radnici), korisnici, uloge, postavke firme |

**Šta da nam vratiš:**
- Ako ti ova tablica odgovara, samo napiši „koristimo ovu”.
- Ako želiš druge uloge (npr. „Računovotja”, „Klijent eksterni”) – napiši **naziv**, **nivo** (broj) i **šta ta uloga smije** (šta vidi, šta može mijenjati).
- Posebno napiši: **Guest** – da li želiš posebnu ulogu „samo pregled” (read-only) ili je „Viewer” dovoljan i on ne smije ništa mijenjati?

---

## 2. Stranice i moduli – ko šta vidi i šta smije raditi

Treba nam odluka po djelovima aplikacije. Za svaki modul napiši:
- **Tko smije uopće ući** (koje uloge vide link / imaju pristup).
- **Tko smije mijenjati** (unos, edit, delete, akcije tipa Storno, Otpis).

Predložak (popuni ili označi šta vrijedi):

| Modul / stranica | Guest (0) | Viewer (1) | Operator (2) | Manager (3) | Admin (4) |
|------------------|-----------|------------|--------------|-------------|-----------|
| **Dashboard** | vidi | vidi | vidi | vidi | vidi |
| **Projekti** (lista, detalj) | samo čitanje | ? | unos/izmjena (koje?) | + zatvaranje? | sve |
| **Inicijacije / Deals** | samo čitanje | ? | ? | ? | sve |
| **Fakture** | samo čitanje | ? | ? | kreiranje/storno? | sve |
| **Naplate** | samo čitanje | ? | ? | ? | sve |
| **Finansije** (potraživanja, dugovanja, banka, početna stanja, otpis) | samo čitanje | ? | ? | sve? | sve |
| **Blagajna** | skriveno? / vidi? | ? | ? | ? | sve |
| **Šifarnici (Studio)** – klijenti, dobavljači, talenti, radnici, cjenovnik, faze | skriveno / samo čitanje? | ? | ? | ? | sve |
| **Korisnici i uloge** (users, roles) | skriveno | skriveno | skriveno | skriveno? | **samo Admin** |
| **Firma (postavke, logo)** | skriveno? | skriveno | skriveno | skriveno? | samo Admin |
| **Mobile dashboard** | vidi | vidi | vidi | vidi | vidi |
| **Izvještaji** | samo čitanje | ? | ? | ? | sve |

**Šta da nam vratiš:**
- Za svaki red: koja uloga **vidi** modul, koja **smije mijenjati** (i šta točno: unos, edit, delete, posebne akcije).
- Ako neki modul Guest **ne smije ni vidjeti** (npr. Korisnici) – napiši „skriveno za Guest”.

---

## 3. Guest (read-only) – posebno

Ako želiš **gosta koji samo gleda** (npr. knjigovođa, partner, vlasnik koji samo pregledava):

- **Kako se uloguje?** Isti login kao ostali (username + lozinka) samo s ulogom Guest, ili želiš poseban „guest link” bez lozinke? (Preporuka: isto login, uloga Guest – jednostavnije i sigurnije.)
- **Šta točno vidi:** sve kao Manager ali **bez** ikakvih dugmadi za unos / izmjenu / brisanje / Storno / Otpis / …? Ili neke stranice uopće ne vidi (npr. Šifarnici skriveni)?
- **Šta ne smije:** ni jedan POST/PUT/DELETE – samo GET (prikaz stranica, podaci za pregled).

Napiši kratko: „Guest = [opis]” i da li želiš da Guest uopće nema pristup nekim dijelovima (npr. Studio skriven).

---

## 4. Koje osobe / korisnike planiraš (primjeri)

Ne trebaju nam lozinke – samo **tipovi** ili primjeri, da znamo kako mapirati uloge.

Npr.:
- „Ja (vlasnik) – Admin.”
- „Knjigovođa – samo pregled financija, read-only” → Guest ili Viewer?
- „Pomoćnik u produkciji – unos projekata i stavki, bez zatvaranja i finansija” → Operator?
- „Account menadžer – sve osim šifarnika i korisnika” → Manager?
- „Eksterni revizor – samo Dashboard i Izvještaji, read-only” → Guest?

Napiši **koliko tipova** korisnika imaš i **jednu rečenicu po tipu** (ko je to, šta smije). To nam je dovoljno da definišemo uloge i permisije.

---

## 5. Tehničko – šta već imaš u bazi

- **Tabele `users` i `roles`:** Jesu li već u upotrebi? Ima li redova (korisnika / uloga)?
- **Kolone u `users`:** Imaš li već `role_id`, `aktivan`, `last_login_at`? (Ako ne, dodaćemo ih prilikom implementacije.)
- **Povezivanje user ↔ radnik:** Želiš li da jedan korisnik (login) bude povezan s jednim zaposlenikom iz šifarnika **radnici** („ulogovan je X, zaposlenik Y”)? Da ili ne.

Odgovori kratko: stanje users/roles (prazno / ima podataka), i da/ne za user–radnik vezu.

---

## 6. Sažetak – šta nam treba od tebe

1. **Lista uloga** – naziv, nivo (broj), šta koja smije (uključujući posebno **Guest / read-only**).
2. **Matrica po modulima** – koja uloga šta vidi i šta smije raditi (ili popunjen predložak iz odjeljka 2).
3. **Odluka za Gosta** – kako se uloguje, šta vidi, šta je skriveno.
4. **Primjeri korisnika** – tipovi (vlasnik, knjigovođa, pomoćnik, …) i koja im uloga odgovara.
5. **Baza** – da li već imaš users/roles popunjene i želiš li user↔radnik.

Kad to sve pošalješ (u ovom formatu ili slobodno tekstom), možemo odmah definirati konkretnu matricu permisija i krenuti u implementaciju (login, middleware, skrivanje linkova, zaštita API-ja).
