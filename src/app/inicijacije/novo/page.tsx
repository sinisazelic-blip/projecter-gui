import { redirect } from "next/navigation";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getDefaultStatusId(): Promise<number> {
  // probaj naći "DRAFT/NACRT", fallback: najmanji status_id
  const cand = await query(
    `SELECT status_id FROM statusi
     WHERE LOWER(naziv) IN ('draft','nacrt')
     ORDER BY status_id ASC
     LIMIT 1`,
  );
  if (cand?.[0]?.status_id) return Number(cand[0].status_id);

  const minRow = await query(`SELECT MIN(status_id) AS mn FROM statusi`);
  return Number(minRow?.[0]?.mn ?? 1);
}

async function createDeal(formData: FormData) {
  "use server";

  const narucilac_id = Number(formData.get("narucilac_id"));
  const krajnji_klijent_id_raw = String(
    formData.get("krajnji_klijent_id") ?? "",
  ).trim();
  const krajnji_klijent_id = krajnji_klijent_id_raw
    ? Number(krajnji_klijent_id_raw)
    : null;

  const radni_naziv = String(formData.get("radni_naziv") ?? "").trim();
  const napomena = String(formData.get("napomena") ?? "").trim() || null;

  if (!Number.isFinite(narucilac_id) || narucilac_id <= 0)
    redirect("/inicijacije/novo");
  if (!radni_naziv) redirect("/inicijacije/novo");

  const status_id = await getDefaultStatusId();

  const res: any = await query(
    `
    INSERT INTO inicijacije
      (narucilac_id, krajnji_klijent_id, radni_naziv, napomena, status_id)
    VALUES
      (?, ?, ?, ?, ?)
    `,
    [narucilac_id, krajnji_klijent_id, radni_naziv, napomena, status_id],
  );

  const newId = Number(res?.insertId ?? 0);
  if (!newId) redirect("/inicijacije");

  redirect(`/inicijacije/${newId}`);
}

export default async function NewDealPage() {
  const klijenti: any[] = await query(
    `SELECT klijent_id, naziv_klijenta FROM klijenti ORDER BY naziv_klijenta ASC LIMIT 2000`,
  );

  return (
    <div className="container">
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Novi Deal</h1>

      <form
        action={createDeal}
        className="card"
        style={{ padding: 14, maxWidth: 860 }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Naručilac (obavezno)
            </div>
            <select
              name="narucilac_id"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.18)",
                background: "rgba(255,255,255,.06)",
                color: "inherit",
                outline: "none",
              }}
              defaultValue=""
            >
              <option value="" disabled>
                — izaberi —
              </option>
              {klijenti.map((k) => (
                <option key={k.klijent_id} value={k.klijent_id}>
                  {k.naziv_klijenta}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Krajnji klijent (opcionalno)
            </div>
            <select
              name="krajnji_klijent_id"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.18)",
                background: "rgba(255,255,255,.06)",
                color: "inherit",
                outline: "none",
              }}
              defaultValue=""
            >
              <option value="">(NULL = isto kao naručilac)</option>
              {klijenti.map((k) => (
                <option key={k.klijent_id} value={k.klijent_id}>
                  {k.naziv_klijenta}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Radni naziv (obavezno)
            </div>
            <input
              name="radni_naziv"
              required
              placeholder="Npr. Spot za X / Kampanja Y / …"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.18)",
                background: "rgba(255,255,255,.06)",
                color: "inherit",
                outline: "none",
              }}
            />
          </div>

          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Napomena (opcionalno)
            </div>
            <textarea
              name="napomena"
              rows={4}
              placeholder="Interna istina studija…"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.18)",
                background: "rgba(255,255,255,.06)",
                color: "inherit",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit">Kreiraj Deal</button>
            <a
              href="/inicijacije"
              className="project-link"
              style={{ alignSelf: "center" }}
            >
              Odustani
            </a>
          </div>
        </div>
      </form>
    </div>
  );
}
