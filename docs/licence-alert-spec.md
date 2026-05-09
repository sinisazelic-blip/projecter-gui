# Licence alerti (Fluxa master / `tenants`)

## Svrha

Automatski podsjetnik klijentu da ne ostane bez alata usred sezone: istek pretplate, kritično malo MEET kodova za SOCCS. Kanal u praksi: **email** (`billing_email`); `billing_phone` je priprema za SMS kad izaberete provajdera.

## Kolone (migracija)

- `billing_email`, `billing_phone` — kontakt (popunjava Studio / kasnije User zone).
- `last_licence_alert_at`, `last_licence_alert_key` — zadnje slanje i **potpis stanja** da se ista poruka ne šalje ponovo dok se stanje ne promijeni.

Pokretanje migracije: `npm run migrate:licence-alert-contacts`.

## Cron

- Ruta: `POST /api/cron/licence-alerts`
- Header: `Authorization: Bearer <LICENCE_ALERT_CRON_SECRET>`
- Env: `LICENCE_ALERT_CRON_SECRET` (obavezno), `LICENCE_ALERT_WEBHOOK_URL` (opciono — ako nije postavljen, job samo loguje JSON u stdout / server log).

## Pragovi (implementacija = `src/lib/licence-alerts/thresholds.ts`)

Obuhvaćaju se samo tenanti sa `status = AKTIVAN` (case-insensitive).

### Pretplata (`subscription_ends_at`)

Jedan „najjači” tag po tenantu (ne kaskada više poruka za isti dan):

| Uslov (`DATEDIFF(kraj, danas)`) | Tag       | Značenje              |
|---------------------------------|-----------|------------------------|
| `< 0`                           | `SUB_EXPIRED` | pretplata istekla |
| `== 0`                          | `SUB_D0`      | zadnji dan          |
| `<= 1`                          | `SUB_LE1`     | ≤ 1 dan             |
| `<= 7`                          | `SUB_LE7`     | ≤ 7 dana            |
| `<= 14`                         | `SUB_LE14`    | ≤ 14 dana           |
| `<= 30`                         | `SUB_LE30`    | ≤ 30 dana           |
| `> 30`                          | —           | nema pretplatnog alerta |

### SOCCS meet kodovi

Samo ako postoji neprazan `soccs_tier` (smatramo da je SOCCS/SwimVoice u igri):

| `meet_remaining` (ISSUED MEET_SESSION) | Tag      |
|------------------------------------------|----------|
| `<= 0`                                   | `MEET_0` |
| `== 1`                                   | `MEET_1` |
| `>= 2`                                   | —        |

### Dedup

- Potpis = sortirani skup tagova, npr. `SUB_LE7|MEET_1`.
- Ako je potpis **jednak** `last_licence_alert_key`, slanje se **preskače** (npr. sljedeći dan i dalje ste u istom „bucketu” isteka).
- Kad se stanje promijeni (npr. s 8 na 7 dana — novi bucket, ili potrošen meet), potpis se mijenja → nova poruka.
- Nakon uspješnog slanja (webhook HTTP OK ili dry run), ažuriraju se `last_licence_alert_at` i `last_licence_alert_key`.

## Šta namjerno nije u prvoj verziji

- **Limit saradnika / korisnika** na klijentskoj instanci zahtijeva podatke izvan ovog mastera (ili poseban model multi-DB) — u specifikaciji za kasnije.
- **SMS** — čeka provajdera i politiku; kolona `billing_phone` je već tu.
- **Više emailova po tenantu** — jedan `billing_email`.

## Webhook payload (JSON)

Polja uključuju: `tenant_id`, `tenant_name`, `billing_email`, `billing_phone`, `days_until_end`, `meet_remaining`, `tags`, `reasons`, `signature`. Na primatelju (n8n, Edge funkcija, mail servis) mapirate u stvarni email.

---

## A) `GET /api/public/licence-check` (klijentska instanca → master)

- **Header:** `Authorization: Bearer <tenants.licence_token>`
- **Odgovor (proširenje, kompatibilno):** postojeća polja `allowed`, `reason` (kao u `LicenceCheckWrapper`) + nova:
  - `warnings`: niz `{ code, severity }` — isti pragovi kao u `thresholds.ts` / gornjim tabelama (`SUB_*`, `MEET_*`). `severity`: `info` | `warning` | `critical`.
  - `tenant_id`, `naziv`, `subscription_ends_at`, `days_until_end`, `meet_remaining`, `soccs_tier` — za prikaz u UI (koverta, SOCCS header, …).
- **`allowed: false`:** `suspended` | `expired` | `disabled` | `invalid_token` (nepoznat token / bez Bearer-a).
- **Greška baze (503):** `allowed: true`, prazan `warnings` — da klijent ne ostane zaključan ako master privremeno ne radi (isti princip kao mrežna greška u wrapperu).

Implementacija: `src/app/api/public/licence-check/route.ts`; pragovi: `buildLicenceWarnings()` u `src/lib/licence-alerts/thresholds.ts`.
