import Link from "next/link";
import { query } from "@/lib/db";
import FluxaLogo from "@/components/FluxaLogo";
import StornirajDugovanjeForm from "./StornirajDugovanjeForm";

export const dynamic = "force-dynamic";

const fmtKM = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2) + " KM";
};

const fmtDate = (d) => {
  if (!d) return "—";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  if (!y || !m || !day) return String(d);
  return `${day}.${m}.${y}`;
};

export default async function DugovanjeDetailPage({ params }) {
  const { dugovanje_id } = await Promise.resolve(params);
  const did = Number(dugovanje_id);

  if (!Number.isFinite(did) || did <= 0) {
    return (
      <div className="container">
        <div className="topbar glass">
          <div className="topbar-left">
            <h1 className="h1">Dugovanje — detalj</h1>
            <div className="subtle">Neispravan dugovanje_id.</div>
          </div>
          <div className="topbar-right">
            <Link className="btn" href="/finance/dugovanja">
              Nazad
            </Link>
          </div>
        </div>
      </div>
    );
  }

  let dug = null;
  try {
    const rows = await query(
      `
      SELECT
        d.dugovanje_id,
        d.projekat_id,
        d.dobavljac_id,
        d.datum,
        d.datum_dospijeca,
        d.iznos_km,
        d.opis,
        d.napomena,
        d.status
      FROM projekt_dugovanja d
      WHERE d.dugovanje_id = ?
      LIMIT 1
      `,
      [did],
    );
    dug = rows?.[0] ?? null;
  } catch {
    const rows = await query(
      `SELECT * FROM projekt_dugovanja WHERE dugovanje_id = ? LIMIT 1`,
      [did],
    );
    dug = rows?.[0] ?? null;
  }

  if (!dug) {
    return (
      <div className="container">
        <div className="topbar glass">
          <div className="topbar-left">
            <h1 className="h1">Dugovanje — detalj</h1>
            <div className="subtle">ID #{did} nije pronađen.</div>
          </div>
          <div className="topbar-right">
            <Link className="btn" href="/finance/dugovanja">
              Nazad
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const paidRows = await query(
    `SELECT * FROM v_dugovanja_paid_sum WHERE dugovanje_id = ? LIMIT 1`,
    [did],
  ).catch(() => []);

  const paid = paidRows?.[0] ?? null;
  const paidKm = paid?.paid_km ?? 0;
  const iznosKm = dug.iznos_km ?? dug.iznos ?? null;
  const remaining =
    Number.isFinite(Number(iznosKm)) && Number.isFinite(Number(paidKm))
      ? Number(iznosKm) - Number(paidKm)
      : null;

  const needle = (dug.opis || dug.napomena || "").trim().slice(0, 40);
  const bankHref = needle
    ? `/finance/banka?q=${encodeURIComponent(needle)}`
    : "/finance/banka";

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">Dugovanje #{dug.dugovanje_id}</div>
                  <div className="brandSub">Finansije / Obaveze</div>
                </div>
              </div>

              <div className="actions">
                <Link className="btn" href={bankHref}>
                  Banka
                </Link>
                <Link className="btn" href="/finance/dugovanja">
                  Lista
                </Link>
                <Link className="btn" href="/finance">
                  Finansije
                </Link>
                <Link className="btn" href="/dashboard" title="Dashboard">
                  🏠 Dashboard
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
      <div className="card">
        <div className="cardHead">
          <div className="cardTitle">Osnovno</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          <div>
            <div className="label">Projekat</div>
            <div>{dug.projekat_id ?? "—"}</div>
          </div>
          <div>
            <div className="label">Dobavljač ID</div>
            <div>{dug.dobavljac_id ?? "—"}</div>
          </div>
          <div>
            <div className="label">Datum</div>
            <div>{fmtDate(dug.datum)}</div>
          </div>
          <div>
            <div className="label">Dospijeće</div>
            <div>{fmtDate(dug.datum_dospijeca)}</div>
          </div>
          <div>
            <div className="label">Iznos</div>
            <div>{fmtKM(dug.iznos_km ?? dug.iznos)}</div>
          </div>
          <div>
            <div className="label">Plaćeno</div>
            <div>{fmtKM(paidKm)}</div>
          </div>
          <div>
            <div className="label">Preostalo</div>
            <div>{remaining !== null ? fmtKM(remaining) : "—"}</div>
          </div>
          <div>
            <div className="label">Status</div>
            <div>
              {(dug.status || "").toUpperCase() === "STORNO"
                ? <span className="badge badge-red">STORNO</span>
                : (dug.status ?? "—")}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="label">Opis</div>
          <div>{dug.opis ?? "—"}</div>
        </div>
        {dug.napomena ? (
          <div style={{ marginTop: 12 }}>
            <div className="label">Napomena</div>
            <div className="muted">{dug.napomena}</div>
          </div>
        ) : null}
        {(dug.status || "").toUpperCase() !== "STORNO" && (
          <>
            <div className="hr" style={{ marginTop: 14 }} />
            <div className="cardTitle" style={{ marginBottom: 4 }}>Storniraj dugovanje</div>
            <div className="subtle" style={{ fontSize: 13 }}>
              Ako dug više nije na teret (firma ugašena, storno ranijih godina), možeš ga stornirati.
            </div>
            <StornirajDugovanjeForm dugovanjeId={dug.dugovanje_id} />
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="cardTitle">Kasnije</div>
        <div className="cardSub">
          Veze na plaćanja (projekt_dugovanje_placanje_link) i CRUD. Za sada
          read-only prikaz.
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
