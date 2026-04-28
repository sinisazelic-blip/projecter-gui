import Link from "next/link";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { apiGet } from "@/lib/api";
import { query } from "@/lib/db";
import { getPocetnaStanja } from "@/lib/pocetna-stanja";
import { getValidLocale } from "@/lib/i18n";
import { getT } from "@/lib/translations";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import FluxaLogo from "@/components/FluxaLogo";

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
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value ?? "sr");
  const t = getT(locale);
  const sp = await Promise.resolve(searchParams);

  let pocetnaStanja = { klijenti: [], dobavljaci: [], talenti: [] };
  try {
    pocetnaStanja = await getPocetnaStanja();
  } catch {
    // ignore
  }
  const aktivnaPocetnaKlijenti = (pocetnaStanja.klijenti || []).filter(
    (r) =>
      !r?.otpisano &&
      Number(r?.remaining_km ?? r?.iznos_km ?? 0) > 0.001,
  );

  // ✅ projekat filter iz URL-a
  const projekatIdRaw = sp?.projekat_id ?? "";
  const projekatId = String(projekatIdRaw || "").trim();

  const onlyLate = sp?.only_late === "1";
  const fakt = sp?.fakturisano ?? "";
  const narId = sp?.narucilac_id ?? "";
  const dueFrom = sp?.due_from ?? "";
  const dueTo = sp?.due_to ?? "";
  const upcomingDays = sp?.upcoming_days ?? "";

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
  if (!onlyLate && String(upcomingDays).trim() !== "") {
    params.set("upcoming_days", String(upcomingDays));
  }

  const qs = params.toString() ? `?${params.toString()}` : "";
  let rows = [];
  let apiError = null;
  try {
    const proto =
      headerStore.get("x-forwarded-proto") ||
      (process.env.NODE_ENV === "production" ? "https" : "http");
    const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
    const cookieHeader = headerStore.get("cookie") || "";
    const apiPath = `/api/naplate${qs}`;
    const apiUrl = host ? `${proto}://${host}${apiPath}` : apiPath;
    const json = await apiGet(apiUrl, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (!json || typeof json !== "object" || !Array.isArray(json.data)) {
      throw new Error("Naplata API nije vratio očekivani JSON format.");
    }
    rows = json.data;
  } catch (e) {
    apiError = e?.message || String(e);
    rows = [];
  }

  const unpaidRows = rows.filter((r) => Number(r?.neplaceno ?? r?.iznos ?? 0) > 0.0001);
  const paidRows = rows.filter((r) => Number(r?.naplaceno ?? 0) > 0.0001);
  const tableRows = unpaidRows.length > 0 ? unpaidRows : paidRows;

  // ✅ Reset: ako si u projektu, resetuj filtere ali ostani na projektu
  const resetHref = projekatId
    ? `/naplate?projekat_id=${encodeURIComponent(projekatId)}`
    : "/naplate";

  // period ispod naslova
  let periodText = "";
  if (onlyLate) {
    periodText = t("naplatePage.onlyLatePeriod");
  } else if (dueFrom || dueTo) {
    const fromTxt = dueFrom ? fmtDateDMY(dueFrom) : "—";
    const toTxt = dueTo ? fmtDateDMY(dueTo) : "—";
    periodText = t("naplatePage.periodFromTo").replace("{{from}}", fromTxt).replace("{{to}}", toTxt);
  } else {
    if (String(upcomingDays || "").trim() === "") {
      periodText = t("naplatePage.all") || "Svi rokovi";
    } else {
      const today = new Date();
      const to = addDays(today, Number(upcomingDays || 14));
      periodText = t("naplatePage.periodFromTo").replace("{{from}}", fmtDateDMY(today)).replace("{{to}}", fmtDateDMY(to));
    }
  }

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
                  <div className="brandTitle">{t("naplatePage.title")}</div>
                  <div className="brandSub">
                    {periodText}
                    {projekatId ? ` · ${t("naplatePage.projectHash")}${projekatId}` : ""}
                  </div>
                </div>
              </div>

              <div className="actions">
                {projekatId && (
                  <Link
                    href={`/projects/${encodeURIComponent(projekatId)}`}
                    className="btn"
                    title={`${t("naplatePage.projectHash")}${projekatId}`}
                  >
                    {t("naplatePage.projectHash")}{projekatId}
                  </Link>
                )}
                <Link href="/finance" className="btn" title={t("naplatePage.finance")}>
                  {t("naplatePage.finance")}
                </Link>
                <Link href="/dashboard" className="btn" title={t("naplatePage.dashboard")}>
                  <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("naplatePage.dashboard")}
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
      {apiError && (
        <div className="card" style={{ marginBottom: 12, borderColor: "rgba(248,113,113,.35)" }}>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontWeight: 700, color: "#f87171" }}>{t("common.error") || "Greška"}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {String(apiError)}
            </div>
          </div>
        </div>
      )}
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
                {t("naplatePage.onlyLate")}
              </label>

              {!onlyLate && (
                <>
                  <span style={{ opacity: 0.75 }}>{t("naplatePage.upcomingLabel")}</span>
                  <select
                    name="upcoming_days"
                    defaultValue={String(upcomingDays)}
                    style={inputStyle}
                  >
                    <option value="">{t("naplatePage.all")}</option>
                    <option value="7">{t("naplatePage.days7")}</option>
                    <option value="14">{t("naplatePage.days14")}</option>
                    <option value="30">{t("naplatePage.days30")}</option>
                  </select>
                </>
              )}

              <span style={{ opacity: 0.75 }}>{t("naplatePage.invoicedLabel")}</span>
              <select
                name="fakturisano"
                defaultValue={String(fakt)}
                style={inputStyle}
              >
                <option value="">{t("naplatePage.all")}</option>
                <option value="1">{t("naplatePage.yes")}</option>
              </select>

              <span style={{ opacity: 0.75 }}>{t("naplatePage.narucilacLabel")}</span>
              <select
                name="narucilac_id"
                defaultValue={String(narId)}
                style={{ ...inputStyle, minWidth: 220 }}
              >
                <option value="">{t("naplatePage.all")}</option>
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
                {t("naplatePage.currencyLabel")} <span style={{ opacity: 0.9 }}>dd.mm.yyyy</span> {t("naplatePage.to")}{" "}
                <span style={{ opacity: 0.9 }}>dd.mm.yyyy</span>
              </span>

              <input
                type="date"
                name="due_from"
                defaultValue={String(dueFrom)}
                className="input"
                style={{ width: "auto" }}
              />
              <span style={{ opacity: 0.65 }}>{t("naplatePage.to")}</span>
              <input
                type="date"
                name="due_to"
                defaultValue={String(dueTo)}
                className="input"
                style={{ width: "auto" }}
              />

              <span style={{ opacity: 0.55, fontSize: 12 }}>
                {t("naplatePage.dateFormatHint")}
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
              {t("naplatePage.filterBtn")}
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
              {t("naplatePage.resetBtn")}
            </Link>
          </div>
        </div>
      </form>
      </div>

      {/* Početna stanja — potraživanja od klijenata */}
      {aktivnaPocetnaKlijenti.length > 0 && (
        <div className="card" style={{ marginTop: 12, marginBottom: 12 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{t("naplatePage.pocetnaStanjaTitle")}</span>
            <Link href="/finance/pocetna-stanja" className="btn" style={{ fontSize: 13 }}>
              {t("naplatePage.pocetnaStanjaLink")}
            </Link>
          </div>
          <div style={{ padding: "10px 16px" }}>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              <table className="table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 10px" }}>{t("naplatePage.client")}</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>{t("naplatePage.amountKm")}</th>
                  </tr>
                </thead>
                <tbody>
                  {aktivnaPocetnaKlijenti.map((r) => (
                    <tr key={r.klijent_id} style={r.otpisano ? { opacity: 0.6 } : undefined}>
                      <td style={{ padding: "6px 10px" }}>{r.naziv}{r.otpisano ? ` ${t("naplatePage.writtenOff")}` : ""}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>
                        {fmtMoney(r.remaining_km ?? r.iznos_km, "KM")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "1px solid var(--border)", fontWeight: 700 }}>
                    <td style={{ padding: "8px 10px" }}>{t("naplatePage.totalActive")}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>
                      {fmtMoney(
                        aktivnaPocetnaKlijenti.reduce(
                          (s, x) => s + Number(x.remaining_km ?? x.iznos_km ?? 0),
                          0,
                        ),
                        "KM",
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span className="muted">
          {(t("naplatePage.shownCount") || "").replace("{{count}}", String(tableRows.length))}
          {paidRows.length ? ` · ${t("naplatePage.paidLabel") || "plaćeno"}: ${paidRows.length}` : ""}
        </span>
        <ExportExcelButton
          filename="naplate"
          sheetName={t("naplatePage.title")}
          headers={[
            t("naplatePage.projectId"),
            t("naplatePage.project"),
            t("naplatePage.narucilac"),
            t("naplatePage.krajnjiKlijent"),
            t("naplatePage.amount"),
            t("naplatePage.currency"),
            t("naplatePage.dueDate"),
            t("naplatePage.days"),
            t("naplatePage.status"),
            t("naplatePage.paidLabel") || "Plaćeno",
            t("naplatePage.unpaidLabel") || "Neplaćeno",
          ]}
          rows={tableRows.map((r) => [
            r.projekat_id ?? "",
            r.radni_naziv ?? "",
            r.narucilac_naziv ?? "—",
            r.krajnji_klijent_naziv ?? "—",
            r.iznos ?? "",
            r.valuta ?? "",
            r.datum_valute ? fmtDateDMY(r.datum_valute) : "—",
            r.dana_do_valute ?? r.dana_kasni ?? "—",
            r.naplata_status ?? "",
            r.naplaceno ?? 0,
            r.neplaceno ?? r.iznos ?? 0,
          ])}
        />
      </div>
      <div className="tableCard">
      <table className="table">
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>{t("naplatePage.project")}</th>
            <th>{t("naplatePage.narucilac")}</th>
            <th>{t("naplatePage.krajnjiKlijent")}</th>
            <th className="num">{t("naplatePage.amount")}</th>
            <th>{t("naplatePage.dueDate")}</th>
            <th className="num">{t("naplatePage.days")}</th>
            <th>{t("naplatePage.status")}</th>
          </tr>
        </thead>

        <tbody>
          {tableRows.map((r, i) => (
            <tr key={r.faktura_id != null ? `${r.projekat_id}-${r.faktura_id}` : `row-${i}`}>
              <td className="cell-wrap" style={{ textAlign: "left" }}>
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

      {tableRows.length === 0 && (
        <div className="muted" style={{ marginTop: 12, padding: 12 }}>
          {t("naplatePage.noItems")}
        </div>
      )}
      </div>

        </div>
      </div>
    </div>
  );
}
