# Fluxa: Povezivanje Korisnika (Users) i Radnika

## Kako sistem radi

### 1. Dvije odvojene stvari

| Šta | Gdje | Šta sadrži |
|-----|------|------------|
| **Radnici** | Šifarnici → Radnici | Ime, prezime, kontakt… (šifarnik ljudi) |
| **Korisnici** | Šifarnici → Korisnici | Username, password, Uloga (role), **Radnik** (opciono) |

**Radnik nema login.** Radnik je samo zapis u šifarniku – osoba koja radi u firmi.

**Korisnik ima login.** Korisnik je onaj koji se uloguje (username + password) i ima ulogu (Admin, Owner, Saradnik…).

---

### 2. Povezivanje: iz Korisnika, ne iz Radnika

Povezivanje se radi u **Korisnici** modulu:

1. Otvori **Šifarnici → Korisnici**
2. Kreiraj novog korisnika ili edituj postojećeg
3. U polju **"Radnik"** izaberi radnika iz dropdowna (lista iz šifarnika Radnici)
4. Sačuvaj

To postavlja `users.radnik_id = radnici.radnik_id`.

U **Radnici** modulu nema polja za username/password – radnik je samo šifarnik.

---

### 3. Uloge (Roles) i nivo pristupa

| Uloga | nivo_ovlastenja | Pristup |
|-------|-----------------|---------|
| Admin / Owner | 1+ | Puni pristup |
| Saradnik | 0 | Samo projekti gdje je angažovan |

**Saradnik** vidi samo projekte gdje je njegov `radnik_id` u:
- **projekat_faza_radnici** (dodjeljen u fazama projekta)
- **projekat_crew** (dodjeljen u Crew projekta)

---

### 4. Workflow: kako omogućiti saradniku da se uloguje

1. **Kreiraj Radnika** (Šifarnici → Radnici)  
   - Ime, prezime, itd.

2. **Kreiraj Korisnika** (Šifarnici → Korisnici)  
   - Username (npr. `marko.kovac`)  
   - Password  
   - Uloga: **Saradnik** (nivo 0)  
   - **Radnik**: izaberi tog radnika iz dropdowna  

3. Saradnik se sada može ulogovati i vidi samo projekte gdje je angažovan (faze ili Crew).

---

### 5. Account Manager

Kad neko otvori projekat iz Deala, sistem uzima `users.radnik_id` ulogovanog korisnika i postavlja ga kao Account Managera.

**Ako korisnik nema povezanog radnika** (`users.radnik_id` je NULL), Account Manager ostaje prazan.

**Rješenje:** U Korisnici, za svakog korisnika koji može otvarati projekte (npr. ti kao owner), izaberi odgovarajućeg radnika u polju "Radnik".

---

### 6. Baza

```
users
  ├── user_id, username, password, role_id
  └── radnik_id  ← opciono, FK na radnici.radnik_id

radnici
  └── radnik_id, ime, prezime, ...

roles
  └── role_id, naziv, nivo_ovlastenja (0 = saradnik, 1+ = owner/admin)
```
