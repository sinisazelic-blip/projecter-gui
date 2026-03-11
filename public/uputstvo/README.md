# Slike za korisničko uputstvo (/uputstvo)

Screenshoti i ostale slike koje se prikazuju na stranici **Uputstvo** u aplikaciji.

**Gdje staviti:** ovaj folder — `public/uputstvo/`

**Kako se referencira u kodu:** putanja od roota, npr. `/uputstvo/dashboard.png`, `/uputstvo/deal.png`.

Preporuka imena fajlova (1–2 slike po modulu):
- `dashboard.png` — Dashboard
- `deal.png` ili `inicijacija.png` — Deal / Inicijacija
- `projekt.png` — Projekat (detalj)
- `faktura.png` — Faktura (wizard ili pregled)

U `src/app/uputstvo/content-sr.ts` i `content-en.ts` slike se u HTML-u stavljaju npr.:
`<img src="/uputstvo/dashboard.png" alt="Dashboard" />` ili u `<p>` s tekstom.
