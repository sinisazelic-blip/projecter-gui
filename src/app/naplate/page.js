import Link from "next/link";
import { apiGet } from "@/lib/api";
import { query } from "@/lib/db";
import { ExportExcelButton } from "@/components/ExportExcelButton";

const inputStyle = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  outline: "none",
};

function fmtMoney(v, cur) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return `${v} ${cur || ""}`.trim();
  return `${n.toFixed(2)} ${cur || "BAM"}`.trim();
}

function fmtDateDMY(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function daysCell(r) {
  if (r?.naplata_status === "kasni") {
    const d = Number(r?.dana_kasni || 0);
    return <span style={{ color: "#f87171", fontWeight: 700 }}>{`-${d}`}</span>;
  }
  if (r?.datum_valute) {
    const d = r?.dana_do_valute;
    return <span style={{ color: "#4ade80", fontWeight: 700 }}>{d}</span>;
  }
  return <span style={{ opacity: 0.6 }}>—</span>;
}

export default async function Page({ searchParams }) {
  const sp = await Promise.resolve(searchParams);

  // ✅ projekat filter iz URL-a
  const projekatIdRaw = sp?.projekat_id ?? "";
  const projekatId = String(projekatIdRaw || "").trim();

  const onlyLate = sp?.only_late === "1";
  const fakt = sp?.fakturisano ?? "";
  const narId = sp?.narucilac_id ?? "";
  const dueFrom = sp?.due_from ?? "";
  const dueTo = sp?.due_to ?? "";
  const upcomingDays = sp?.upcoming_days ?? "14";

  const narucioci = await query(`
    SELECT klijent_id, naziv_klijenta
    FROM klijenti
    ORDER BY naziv_klijenta ASC
  `);

  const params = new URLSearchParams();

  // ✅ proslijedi projekat_id ka API-ju
  if (projekatId) params.set("projekat_id", projekatId);

  if (onlyLate) params.set("only_late", "1");
  // Fakturisano: po defaultu prikaži sve fakturisane (status_id = 9)
  // Ako je eksplicitno odabrano "DA", filtriraj po v.fakturisano = 1
  if (fakt === "1") params.set("fakturisano", "1");
  if (narId) params.set("narucilac_id", narId);
  if (dueFrom) params.set("due_from", dueFrom);
  if (dueTo) params.set("due_to", dueTo);
  if (!onlyLate) params.set("upcoming_days", String(upcomingDays || "14"));

  const qs = params.toString() ? `?${params.toString()}` : "";
  const json = await apiGet(`/api/naplate${qs}`);
  const rows = json.data ?? [];

  // ✅ Reset: ako si u projektu, resetuj filtere ali ostani na projektu
  const resetHref = projekatId
    ? `/naplate?projekat_id=${encodeURIComponent(projekatId)}`
    : "/naplate";

  // period ispod naslova
  let periodText = "";
  if (onlyLate) {
    periodText = "Samo stavke van valute";
  } else if (dueFrom || dueTo) {
    const fromTxt = dueFrom ? fmtDateDMY(dueFrom) : "—";
    const toTxt = dueTo ? fmtDateDMY(dueTo) : "—";
    periodText = `od ${fromTxt} do ${toTxt}`;
  } else {
    const today = new Date();
    const to = addDays(today, Number(upcomingDays || 14));
    periodText = `od ${fmtDateDMY(today)} do ${fmtDateDMY(to)}`;
  }

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <img
                  src="/fluxa/logo-light.png"
                  alt="FLUXA"
                  className="brandLogo"
                />
                <div>
                  <div className="brandTitle">Naplate</div>
                  <div className="brandSub">
                    {periodText}
                    {projekatId ? ` · Projekat #${projekatId}` : ""}
                  </div>
                </div>
              </div>

              <div className="actions">
                {projekatId && (
                  <Link
                    href={`/projects/${encodeURIComponent(projekatId)}`}
                    className="btn"
                    title={`Projekat #${projekatId}`}
                  >
                    Projekat #{projekatId}
                  </Link>
                )}
                <Link href="/finance" className="btn" title="Finansije">
                  Finansije
                </Link>
                <Link href="/projects" className="btn" title="Projekti">
                  Projekti
                </Link>
                <Link href="/dashboard" className="btn" title="Dashboard">
                  🏠 Dashboard
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
      <div className="card">
      <form method="GET">
        {/* da projekat_id ostane kad filtriraš */}
        {projekatId && (
          <input type="hidden" name="projekat_id" value={projekatId} />
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            flexWrap: "nowrap",
          }}
        >
          {/* Lijevo: filteri */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              flex: 1,
              minWidth: 0,
            }}
          >
            {/* Red 1 */}
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  opacity: 0.9,
                }}
              >
                <input
                  type="checkbox"
                  name="only_late"
                  value="1"
                  defaultChecked={onlyLate}
                />
                Samo van valute
              </label>

              {!onlyLate && (
                <>
                  <span style={{ opacity: 0.75 }}>U narednih:</span>
                  <select
                    name="upcoming_days"
                    defaultValue={String(upcomingDays)}
                    style={inputStyle}
                  >
                    <option value="7">7 dana</option>
                    <option value="14">14 dana</option>
                    <option value="30">30 dana</option>
                  </select>
                </>
              )}

              <span style={{ opacity: 0.75 }}>Fakturisano:</span>
              <select
                name="fakturisano"
                defaultValue={String(fakt)}
                style={inputStyle}
              >
                <option value="">Svi</option>
                <option value="1">DA</option>
              </select>

              <span style={{ opacity: 0.75 }}>Naručilac:</span>
              <select
                name="narucilac_id"
                defaultValue={String(narId)}
                style={{ ...inputStyle, minWidth: 220 }}
              >
                <option value="">Svi</option>
                {narucioci.map((k) => (
                  <option key={k.klijent_id} value={k.klijent_id}>
                    {k.naziv_klijenta}
                  </option>
                ))}
              </select>
            </div>

            {/* Red 2 */}
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span style={{ opacity: 0.75 }}>
                Valuta: <span style={{ opacity: 0.9 }}>dd.mm.yyyy</span> do{" "}
                <span style={{ opacity: 0.9 }}>dd.mm.yyyy</span>
              </span>

              <input
                type="date"
                name="due_from"
                defaultValue={String(dueFrom)}
                className="input"
                style={{ width: "auto" }}
              />
              <span style={{ opacity: 0.65 }}>do</span>
              <input
                type="date"
                name="due_to"
                defaultValue={String(dueTo)}
                className="input"
                style={{ width: "auto" }}
              />

              <span style={{ opacity: 0.55, fontSize: 12 }}>
                (Browser prikazuje svoj format u polju, ali sistem koristi
                dd.mm.yyyy u prikazu.)
              </span>
            </div>
          </div>

          {/* Desno: dugmad */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <button type="submit" className="btn" style={{ minWidth: 110 }}>
              Filtriraj
            </button>
            <Link
              href={resetHref}
              className="btn"
              style={{
                padding: "10px 12px",
                minWidth: 90,
                textAlign: "center",
              }}
            >
              Reset
            </Link>
          </div>
        </div>
      </form>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span className="muted">Prikazano: {rows.length} stavki</span>
        <ExportExcelButton
          filename="naplate"
          sheetName="Naplate"
          headers={["Projekat ID", "Projekat", "Naručilac", "Krajnji klijent", "Iznos", "Valuta", "Datum valute", "Dani", "Status"]}
          rows={rows.map((r) => [
            r.projekat_id ?? "",
            r.radni_naziv ?? "",
            r.narucilac_naziv ?? "—",
            r.krajnji_klijent_naziv ?? "—",
            r.iznos ?? "",
            r.valuta ?? "",
            r.datum_valute ? fmtDateDMY(r.datum_valute) : "—",
            r.dana_do_valute ?? r.dana_kasni ?? "—",
            r.naplata_status ?? "",
          ])}
        />
      </div>
      <div className="tableCard">
      <table className="table">
        <thead>
          <tr>
            <th>Projekat</th>
            <th>Naručilac</th>
            <th>Krajnji klijent</th>
            <th className="num">Iznos</th>
            <th>Valuta</th>
            <th className="num">Dani</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.potrazivanje_id ?? r.projekat_id}>
              <td className="cell-wrap">
                <span style={{ opacity: 0.7, marginRight: 6 }}>
                  #{r.projekat_id}
                </span>
                {r.radni_naziv}
              </td>
              <td>{r.narucilac_naziv ?? "—"}</td>
              <td style={{ opacity: r.krajnji_klijent_naziv ? 1 : 0.6 }}>
                {r.krajnji_klijent_naziv ?? "—"}
              </td>
              <td className="num">{fmtMoney(r.iznos, r.valuta)}</td>
              <td>{r.datum_valute ? fmtDateDMY(r.datum_valute) : "—"}</td>
              <td className="num">{daysCell(r)}</td>
              <td>{r.naplata_status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {rows.length === 0 && (
        <div className="muted" style={{ marginTop: 12, padding: 12 }}>
          Nema stavki za prikaz (po trenutnim filterima).
        </div>
      )}
      </div>

        </div>
      </div>
    </div>
  );
}
