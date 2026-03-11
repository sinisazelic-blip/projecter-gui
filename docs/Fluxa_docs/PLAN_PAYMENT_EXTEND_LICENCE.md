# Povezivanje uplate klijenta s produženjem licence u Master-Fluxi

*Prijedlog: kako uplata klijenta (PayPal / portal) može direktno „naložiti” Master-Fluxi da produži licencu za tog tenanta.*

---

## Kako sada radi

- **Master-Fluxa** (Studio TAF): baza ima tabele `tenants` i `plans`. Svaki tenant ima `subscription_ends_at`, `status` (AKTIVAN / ISTEKLO / SUSPENDOVAN), `licence_token`.
- **Klijentska Fluxa:** u .env ima `LICENCE_CHECK_URL` (master + `/api/public/licence-check`) i `LICENCE_TOKEN`. Pri učitavanju šalje token; master vraća `allowed: true/false` prema `subscription_ends_at` i `status`.
- **Produženje danas:** U Master-Fluxi, u modulu Licence (Dashboard → 🔐), admin ručno bira „Produži” i unosi novi datum. To poziva **PATCH /api/tenant-admin/tenants/[id]** (zahtijeva session).

---

## Šta treba

Kad klijent plati (npr. preko portala koji koristi tvoj PayPal), **portal ili PayPal webhook** treba da javi Master-Fluxi: „Produži tenant X za Y mjeseci” (ili „postavi datum do Z”). Master ažurira `tenants.subscription_ends_at` (i po potrebi `status` u AKTIVAN), bez ulogovanog admina.

---

## Prijedlog rješenja

### 1. Siguran endpoint u Master-Fluxi

**POST /api/public/licence-extend**

- **Namjena:** Poziva ga portal (backend) ili PayPal webhook nakon uspješne uplate. Ažurira `subscription_ends_at` (i eventualno `status`) za određenog tenanta.
- **Sigurnost:** Ne koristi session; zahtijeva **tajni ključ** u headeru (npr. `Authorization: Bearer <secret>` ili `X-Fluxa-Licence-Extend-Secret: <secret>`). Taj ključ držiš u .env Master-Fluxe (npr. `FLUXA_LICENCE_EXTEND_SECRET`) i u portalu; samo tko zna secret može zvati endpoint.
- **Body (JSON):**
  - **Identifikacija tenanta** (jedno od dva):
    - `tenant_id` (broj) – ako portal u bazi/konfigu zna ID tenanta, ili
    - `licence_token` (string) – ako u PayPal uplati šalješ custom_id = licence_token, webhook može identificirati tenanta po njemu.
  - **Novi datum ili produženje** (jedno od dva):
    - `subscription_ends_at` – točan datum u formatu YYYY-MM-DD, ili
    - `extend_months` – broj mjeseci; novi datum = max(danas, trenutni subscription_ends_at) + N mjeseci (ako je pretplata već istekla, računa od danas).
- **Ponašanje:** Pronađe tenant po `tenant_id` ili `licence_token`; ažurira `subscription_ends_at`; ako je status bio ISTEKLO, postavi ga u AKTIVAN; `updated_at = NOW()`. Odgovor `{ ok: true }` ili `{ ok: false, error: "..." }`.

### 2. Tko šta zove

- **Varijanta A – Portal u sredini (preporučeno ispočetka):**  
  Klijent plati na portalu (PayPal). Portal backend prima potvrdu (PayPal IPN/webhook ili ručna provjera). Portal onda poziva Master-Fluxu:  
  `POST https://tvoja-master-fluxa.com/api/public/licence-extend`  
  s headerom `Authorization: Bearer <FLUXA_LICENCE_EXTEND_SECRET>` i body npr.  
  `{ "tenant_id": 5, "extend_months": 12 }`.  
  Portal mora znati koji je tenant_id (npr. po emailu klijenta ili po linku za plaćanje koji sadrži tenant_id / licence_token).

- **Varijanta B – PayPal webhook direktno na Master-Fluxu:**  
  Kod kreiranja plaćanja u PayPal-u u „custom” ili „invoice_id” upišeš npr. `licence_token` (ili tenant_id). Kad PayPal pošalje webhook „payment completed”, tvoj **handler u Master-Fluxi** (npr. POST /api/webhooks/paypal) parsira webhook, izvadi custom_id, provjeri potpis PayPal-a, zatim zove istu logiku kao licence-extend (ili direktno UPDATE tenants). Manje komponenti, ali moraš u Fluxi implementirati verifikaciju PayPal webhook potpisa.

### 3. Preporuka za prvu fazu

- **Portal (od iduće sedmice)** pri kreiranju „Produži pretplatu” / „Kupi licencu” generira link za PayPal s npr. `custom_id = licence_token` (ili tenant_id ako portal ima pristup listi tenanata). Nakon uspješne uplate portal backend poziva **POST /api/public/licence-extend** s tajnim ključem i `licence_token` + `extend_months`.  
- U Master-Fluxi dodaš env **FLUXA_LICENCE_EXTEND_SECRET**; endpoint je implementiran (v. ispod). Kad portal bude živ, samo ga konfiguriraš s tim URL-om i secretom.

---

## Implementacija u repou

- **Ruta:** `src/app/api/public/licence-extend/route.ts` – **implementirano.** POST; čita secret iz env (`FLUXA_LICENCE_EXTEND_SECRET`); provjera u headeru `Authorization: Bearer <secret>` ili `X-Fluxa-Licence-Extend-Secret`; body: `tenant_id` ili `licence_token`, te `subscription_ends_at` (YYYY-MM-DD) ili `extend_months`; UPDATE tenants (+ status AKTIVAN).
- **Env (Master-Fluxa):** `FLUXA_LICENCE_EXTEND_SECRET` – jak random string (min. 16 znaka); isti string u portalu za poziv Fluxe.

---

## Sažetak

| Korak | Tko | Šta |
|-------|-----|-----|
| 1 | Klijent | Plati na portalu (PayPal). |
| 2 | Portal | Prima potvrdu; zna tenant (tenant_id ili licence_token iz linka/custom_id). |
| 3 | Portal | Poziva Master-Fluxu: POST /api/public/licence-extend, Authorization: Bearer &lt;secret&gt;, body { tenant_id ili licence_token, extend_months ili subscription_ends_at }. |
| 4 | Master-Fluxa | Provjeri secret; ažurira tenants; vraća ok. |
| 5 | Klijentska Fluxa | Pri sljedećem učitavanju licence-check i dalje vraća allowed: true (novi subscription_ends_at). |

Ovo ostavlja sve ostalo kako jest: licence-check, token, modul Licence u Master-Fluxi. Samo dodaješ jedan siguran „back door” za automatsko produženje na osnovu uplate.
