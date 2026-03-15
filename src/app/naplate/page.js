import Link from "next/link";
import { cookies } from "next/headers";
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
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value ?? "sr");
  const t = getT(locale);
  const sp = await Promise.resolve(searchParams);

  let pocetnaStanja = { klijenti: [], dobavljaci: [], talenti: [] };
  try {
    pocetnaStanja = await getPocetnaStanja();
  } catch {
    // ignore
  }

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
    periodText = t("naplatePage.onlyLatePeriod");
  } else if (dueFrom || dueTo) {
    const fromTxt = dueFrom ? fmtDateDMY(dueFrom) : "—";
    const toTxt = dueTo ? fmtDateDMY(dueTo) : "—";
    periodText = t("naplatePage.periodFromTo").replace("{{from}}", fromTxt).replace("{{to}}", toTxt);
  } else {
    const today = new Date();
    const to = addDays(today, Number(upcomingDays || 14));
    periodText = t("naplatePage.periodFromTo").replace("{{from}}", fmtDateDMY(today)).replace("{{to}}", fmtDateDMY(to));
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
      {pocetnaStanja.klijenti?.length > 0 && (
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
                  {pocetnaStanja.klijenti.map((r) => (
                    <tr key={r.klijent_id} style={r.otpisano ? { opacity: 0.6 } : undefined}>
                      <td style={{ padding: "6px 10px" }}>{r.naziv}{r.otpisano ? ` ${t("naplatePage.writtenOff")}` : ""}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>{fmtMoney(r.iznos_km, "KM")}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "1px solid var(--border)", fontWeight: 700 }}>
                    <td style={{ padding: "8px 10px" }}>{t("naplatePage.totalActive")}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>
                      {fmtMoney(pocetnaStanja.klijenti.filter((x) => !x.otpisano).reduce((s, x) => s + x.iznos_km, 0), "KM")}
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
        <span className="muted">{t("naplatePage.shownCount").replace("{{count}}", String(rows.length))}</span>
        <ExportExcelButton
          filename="naplate"
          sheetName={t("naplatePage.title")}
          headers={[t("naplatePage.projectId"), t("naplatePage.project"), t("naplatePage.narucilac"), t("naplatePage.krajnjiKlijent"), t("naplatePage.amount"), t("naplatePage.currency"), t("naplatePage.dueDate"), t("naplatePage.days"), t("naplatePage.status")]}
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
            <th>{t("naplatePage.project")}</th>
            <th>{t("naplatePage.narucilac")}</th>
            <th>{t("naplatePage.krajnjiKlijent")}</th>
            <th className="num">{t("naplatePage.amount")}</th>
            <th>{t("naplatePage.currency")}</th>
            <th className="num">{t("naplatePage.days")}</th>
            <th>{t("naplatePage.status")}</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={r.faktura_id != null ? `${r.projekat_id}-${r.faktura_id}` : `row-${i}`}>
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
          {t("naplatePage.noItems")}
        </div>
      )}
      </div>

        </div>
      </div>
    </div>
  );
}
