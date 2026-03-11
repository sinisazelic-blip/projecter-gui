# proJECTer – State i razvojni put (GUI)

## Cilj
Napraviti web GUI za Studio TAF koji se kači na DigitalOcean Managed MySQL bazu (`studio_db`).
Prvo: READ-ONLY analitika i pregled (projekti, klijenti, troškovi, fakture), pa zatim unos (CRUD) kroz GUI.

## Osnovni principi
- Baza je “source of truth”.
- GUI ništa ne radi direktno SQL skriptama; sve ide kroz API.
- Sve valute u GUI prikazujemo kao **KM** (u bazi se može voditi kao BAM radi standarda).
- Historijske tabele (talenti/dobavljači istorija) su “best effort” i služe za analitiku, ne za operativni rad.

## Moduli GUI-a (redoslijed)
1. Dashboard
   - Top brendovi/klijenti po broju projekata i vrijednosti
   - “Šta kasni” (fiksni troškovi + projektni troškovi)
2. Projekti
   - lista + filteri (godina, klijent, status, tip)
   - projekat detalj (troškovi, fakture, uplate)
3. Klijenti
   - lista
   - detalj klijenta + početno stanje + stanje uplata
4. Troškovi (varijabilni/projektni)
   - lista troškova po projektu
   - status: čeka/plaćeno/djelimično
5. Plaćanja
   - jedna uplata može pokriti više troškova (placanja + placanja_stavke)
6. Fiksni troškovi
   - raspored dospijeća
   - status: čeka/kasni/plaćeno
7. Fakture + Fiskalno
   - brojač fakture po godini
   - fiskalni broj je kontinuiran (ne resetuje se)
   - storno fiskalni pravi minus račun i “pojede” broj; kopija fakture dobija sljedeći broj

## App state (frontend)
Minimalno (za start):
- user/session: (kasnije pravi login; sada “admin mode”)
- ui:
  - activeModule: 'dashboard'|'projekti'|'klijenti'|'troskovi'|'placanja'|'fiksni'|'fakture'
  - filters: { godina, klijent_id, status, search }
- data cache:
  - projekti list (paged)
  - klijenti list
  - troskovi po projektu
  - fiksni troskovi raspored
  - fakture list

Preporuka implementacije:
- Server-side fetch (Next.js App Router) za liste (brže, sigurnije).
- Tanak client state samo za filtere i UI.

## Razvojni put (praktično)
Faza 1 (READ-ONLY):
- /projekti (lista)
- /projekti/:id (detalj + troškovi + fakture)
- /klijenti (lista)
- /fiksni-troskovi (dospijeća narednih 30 dana)
Faza 2 (operativno):
- unos projekta
- unos troška
- kreiranje fakture + fiskalni broj (automatski)
- knjiženje uplata i plaćanja
