// src/app/projects/page.js
import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

//export const metadata = {
//  title: "Lista projekata",
//};

/**
 * ✅ KANON status prikaz:
 * - API vraća status_name iz statusi_projekta
 * - ovdje pravimo samo badge stil (boja/label), ali tekst je kanonski.
 */
function statusToneById(statusId) {
  const id = Number(statusId ?? 0);
  if (id === 9) return "status-badge--invoiced"; // Fakturisan
  if (id === 10) return "status-badge--archived"; // Arhiviran
  if (id === 12) return "status-badge--cancelled"; // Otkazan
  if (id === 8) return "status-badge--closed"; // Zatvoren
  if (id === 7) return "status-badge--done"; // Završen
  if (id >= 4 && id <= 6) return "status-badge--active"; // U produkciji / Omega / Postprodukcija
  if (id >= 1 && id <= 3) return "status-badge--planned"; // Otvoren / U razradi / Čeka potvrdu
  return "status-badge--unknown";
}

function StatusBadge({ project }) {
  const label = project?.status_name
    ? String(project.status_name)
    : project?.status_id
      ? `Status #${project.status_id}`
      : "—";
  const cls = statusToneById(project?.status_id);

  return (
    <span className={`status-badge ${cls}`} title={`Status: ${label}`}>
      <span className="status-badge__dot" />
      {label}
    </span>
  );
}

/**
 * Financial status badge helpers
 * - vrijednosti: bez_budzeta | u_plusu | u_minusu
 */
function normalizeFinStatus(project) {
  const raw = project?.finansijski_status;
  if (!raw) return "unknown";
  return String(raw).trim().toLowerCase();
}

function finMeta(fin) {
  switch (fin) {
    case "bez_budzeta":
      return { label: "BEZ BUDŽETA", className: "fin-badge--bez_budzeta" };
    case "u_plusu":
      return { label: "U PLUSU", className: "fin-badge--u_plusu" };
    case "u_minusu":
      return { label: "U MINUSU", className: "fin-badge--u_minusu" };
    default:
      return { label: "FIN: ?", className: "fin-badge--unknown" };
  }
}

function FinancialBadge({ project }) {
  const fin = normalizeFinStatus(project);
  const meta = finMeta(fin);

  return (
    <span
      className={`fin-badge ${meta.className}`}
      title={`Fin status: ${fin}`}
    >
      <span className="fin-badge__dot" />
      {meta.label}
    </span>
  );
}

/**
 * ✅ Operativni signal (NORMALNO/PAZNJA/STOP) — “vidi se iz aviona”
 */
function normalizeSignal(project) {
  const raw = project?.operativni_signal;
  const s = String(raw ?? "NORMALNO")
    .trim()
    .toUpperCase();
  if (s === "PAZNJA") return "PAZNJA";
  if (s === "STOP") return "STOP";
  return "NORMALNO";
}
function signalMeta(sig) {
  if (sig === "STOP") {
    return {
      label: "STOP",
      bg: "rgba(255, 80, 80, .22)",
      border: "rgba(255, 80, 80, .35)",
      dot: "rgba(255, 80, 80, .95)",
    };
  }
  if (sig === "PAZNJA") {
    return {
      label: "PAZNJA",
      bg: "rgba(255, 165, 0, .20)",
      border: "rgba(255, 165, 0, .35)",
      dot: "rgba(255, 165, 0, .95)",
    };
  }
  return {
    label: "NORMALNO",
    bg: "rgba(80, 220, 140, .18)",
    border: "rgba(80, 220, 140, .32)",
    dot: "rgba(80, 220, 140, .95)",
  };
}

function SignalBadge({ project }) {
  const sig = normalizeSignal(project);
  const meta = signalMeta(sig);

  return (
    <span
      title={`Operativni signal: ${sig}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background: meta.bg,
        fontWeight: 750,
        letterSpacing: 0.3,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: meta.dot,
          boxShadow: "0 0 0 3px rgba(255,255,255,.06)",
          display: "inline-block",
        }}
      />
      {meta.label}
    </span>
  );
}

/**
 * ✅ Deadline helpers (dd.mm.yyyy + semafor)
 */
function pad2(n) {
  const s = String(n ?? "");
  return s.length === 1 ? "0" + s : s;
}
function isValidDate(d) {
  return d instanceof Date && Number.isFinite(d.getTime());
}
function parseToDateOnly(v) {
  if (!v) return null;

  if (v instanceof Date && isValidDate(v)) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }

  const s0 = String(v).trim();
  if (!s0) return null;

  const s10 = s0.slice(0, 10);
  const mIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s10);
  if (mIso) {
    const y = Number(mIso[1]);
    const mo = Number(mIso[2]);
    const d = Number(mIso[3]);
    return new Date(y, mo - 1, d);
  }

  const d = new Date(s0);
  if (isValidDate(d))
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());

  return null;
}
function fmtDDMMYYYY(dateOnly) {
  if (!dateOnly) return "—";
  const d = dateOnly.getDate();
  const m = dateOnly.getMonth() + 1;
  const y = dateOnly.getFullYear();
  return `${pad2(d)}.${pad2(m)}.${y}`;
}
function computeDaysDiff(dateOnly) {
  if (!dateOnly) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ms = dateOnly.getTime() - today.getTime();
  return Math.round(ms / 86400000);
}
function semColor(daysDiff) {
  if (daysDiff === null) return "gray";
  if (daysDiff <= 0) return "red";
  if (daysDiff <= 3) return "orange";
  return "green";
}
function semLabel(daysDiff) {
  if (daysDiff === null) return "rok nepoznat";
  if (daysDiff < 0) return `kasni ${Math.abs(daysDiff)}d`;
  if (daysDiff === 0) return "danas";
  if (daysDiff === 1) return "sutra";
  return `za ${daysDiff}d`;
}
function dotBg(sem) {
  if (sem === "red") return "rgba(255, 80, 80, .95)";
  if (sem === "orange") return "rgba(255, 165, 0, .95)";
  if (sem === "green") return "rgba(80, 220, 140, .95)";
  return "rgba(180, 180, 180, .85)";
}

const fmt = (v) => {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toFixed(2) + " KM";
};

const inputStyle = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  outline: "none",
};

function buildQuery(paramsObj) {
  const parts = [];
  for (const [k, v] of Object.entries(paramsObj)) {
    if (v === null || v === undefined) continue;
    const s = String(v);
    if (!s) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(s)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

// ✅ sortiranje po master contextu (active grupa => po roku)
function sortProjects(rows, status_group) {
  const list = Array.isArray(rows) ? [...rows] : [];

  if (String(status_group) === "active") {
    list.sort((a, b) => {
      const da = parseToDateOnly(a?.rok_glavni);
      const db = parseToDateOnly(b?.rok_glavni);

      const ta = da ? da.getTime() : Number.POSITIVE_INFINITY;
      const tb = db ? db.getTime() : Number.POSITIVE_INFINITY;

      if (ta !== tb) return ta - tb;
      return Number(a?.projekat_id ?? 0) - Number(b?.projekat_id ?? 0);
    });
    return list;
  }

  if (String(status_group) === "archive") {
    list.sort(
      (a, b) => Number(a?.projekat_id ?? 0) - Number(b?.projekat_id ?? 0),
    );
    return list;
  }

  return list;
}

async function apiGetNoStore(path) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}${path}`, {
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  });
  const json = await res.json().catch(() => null);
  return json;
}

// ✅ Server-side interpretacija status_pick (nema JS interaktivnosti)
function parseStatusPick(status_pick_raw) {
  const s = String(status_pick_raw ?? "").trim();
  if (!s) return { status_group: "active", status_id: null };

  if (s.startsWith("group:")) {
    const g = s.slice("group:".length).toLowerCase();
    if (g === "active" || g === "archive" || g === "all")
      return { status_group: g, status_id: null };
    return { status_group: "active", status_id: null };
  }

  const n = Number(s);
  if (Number.isFinite(n) && n > 0) return { status_group: "all", status_id: n }; // exact status => group all
  return { status_group: "active", status_id: null };
}

/* =========================
   ✅ STATUS TIMELINE (LISTA)
   Deal - Produkcija - Završen - Zatvoren - Fakturisan - Arhiviran
   - aktivni korak: boja (po status_id)
   - prošli koraci: sivi
   - budući: neutral
   ========================= */
const FLOW_STEPS = [
  { k: "DEAL", label: "Deal" },
  { k: "PROD", label: "Produkcija" },
  { k: "DONE", label: "Završen" },
  { k: "CLOSED", label: "Zatvoren" },
  { k: "INVOICED", label: "Fakturisan" },
  { k: "ARCH", label: "Arhiviran" },
];

function flowIndexForProjectStatusId(statusId) {
  const id = Number(statusId ?? 0);

  // 10/12 (arhiva/otkazan) => zadnji korak
  if (id === 10 || id === 12) return 5;

  // 9 = fakturisan
  if (id === 9) return 4;

  // 8 = zatvoren
  if (id === 8) return 3;

  // 7 = završen
  if (id === 7) return 2;

  // 4–6 = produkcija
  if (id >= 4 && id <= 6) return 1;

  // 1–3 = još smo u deal-u
  if (id >= 1 && id <= 3) return 0;

  // fallback
  return 0;
}

function flowAccentByProjectStatusId(statusId) {
  const id = Number(statusId ?? 0);

  // Arhiva/otkazan
  if (id === 10 || id === 12) {
    return {
      dot: "rgba(180, 180, 180, .85)",
      line: "rgba(180, 180, 180, .45)",
      text: "rgba(255,255,255,.78)",
    };
  }

  // Fakturisan
  if (id === 9) {
    return {
      dot: "rgba(80, 170, 255, .95)",
      line: "rgba(80, 170, 255, .45)",
      text: "rgba(255,255,255,.90)",
    };
  }

  // Zatvoren
  if (id === 8) {
    return {
      dot: "rgba(255, 193, 7, .95)",
      line: "rgba(255, 193, 7, .45)",
      text: "rgba(255,255,255,.90)",
    };
  }

  // Završen
  if (id === 7) {
    return {
      dot: "rgba(55,214,122,.95)",
      line: "rgba(55,214,122,.45)",
      text: "rgba(255,255,255,.90)",
    };
  }

  // Produkcija (4–6) i deal (1–3) => zelena kao “aktivno”
  return {
    dot: "rgba(55,214,122,.95)",
    line: "rgba(55,214,122,.45)",
    text: "rgba(255,255,255,.90)",
  };
}

function StatusFlowInline({ project }) {
  const statusId = Number(project?.status_id ?? 0);
  const activeIdx = flowIndexForProjectStatusId(statusId);
  const acc = flowAccentByProjectStatusId(statusId);

  return (
    <div
      style={{
        width: "100%",
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid rgba(255,255,255,.10)",
      }}
      aria-label="Tok statusa"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${FLOW_STEPS.length}, minmax(0, 1fr))`,
          gap: 10,
          alignItems: "start",
        }}
      >
        {FLOW_STEPS.map((s, idx) => {
          const isPast = idx < activeIdx;
          const isActive = idx === activeIdx;

          const dotColor = isPast
            ? "rgba(160,160,160,.75)"
            : isActive
              ? acc.dot
              : "rgba(255,255,255,.18)";

          const lineColor = isPast
            ? "rgba(160,160,160,.35)"
            : idx <= activeIdx
              ? acc.line
              : "rgba(255,255,255,.10)";

          const textColor = isPast
            ? "rgba(255,255,255,.55)"
            : isActive
              ? acc.text
              : "rgba(255,255,255,.72)";

          const fontW = isActive ? 900 : 700;

          return (
            <div key={s.k} style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: dotColor,
                    boxShadow: "0 0 0 3px rgba(255,255,255,.06)",
                    flex: "0 0 auto",
                  }}
                />
                <div
                  aria-hidden="true"
                  style={{
                    height: 3,
                    borderRadius: 99,
                    background: lineColor,
                    flex: 1,
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  fontWeight: fontW,
                  color: textColor,
                  lineHeight: 1.15,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={s.label}
              >
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function Page({ searchParams }) {
  const sp = await Promise.resolve(searchParams);

  const finRaw = sp?.fin_status ?? "";
  const legacyRaw = sp?.legacy ?? "";
  const qRaw = sp?.q ?? "";
  const showDoneRaw = sp?.show_done ?? "";
  const showDone = String(showDoneRaw) === "1";

  // ✅ pagination
  const page = Math.max(1, Number(sp?.page ?? 1) || 1);
  const limit = Math.max(1, Math.min(200, Number(sp?.limit ?? 50) || 50));

  // ✅ status picker: jedini input iz forme
  const status_pick = sp?.status_pick ?? "";

  // ✅ server decides
  const parsed = parseStatusPick(status_pick);
  const status_group = parsed.status_group;
  const status_id = parsed.status_id;

  // ✅ status dropdown source: statusi_projekta (KANON)
  const statuses = await query(
    `SELECT status_id, naziv_statusa FROM statusi_projekta ORDER BY status_id ASC`,
  );

  const qs = buildQuery({
    status_group,
    status_id: status_id ? String(status_id) : "",
    fin_status: finRaw,
    legacy: legacyRaw,
    q: qRaw,
    show_done: showDone ? "1" : "",
    page: String(page),
    limit: String(limit),
  });

  const json = await apiGetNoStore(`/api/projects${qs}`);
  const projectsRaw = json?.rows ?? [];
  const total = Number(json?.total ?? 0);

  const projects = sortProjects(projectsRaw, status_group);

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  const hasPrev = page > 1;
  const hasNext = page * limit < total;

  function pageLink(nextPage) {
    return buildQuery({
      status_pick,
      fin_status: finRaw,
      legacy: legacyRaw,
      q: qRaw,
      show_done: showDone ? "1" : "",
      page: String(nextPage),
      limit: String(limit),
    });
  }

  // ✅ default selected value for dropdown (reflect current state)
  const statusSelectValue = status_id
    ? String(status_id)
    : `group:${status_group}`;

  return (
    <div className="container">
      <style>{`
        /* ✅ Minimal “glass” kozmetika (Fluxa official) */
        .pageWrap {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .topBlock {
          position: sticky;
          top: 0;
          z-index: 30;
          padding: 14px 0 12px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          box-shadow: 0 14px 40px rgba(0,0,0,.22);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .topInner {
          padding: 0 14px;
        }

        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandLogo { height: 30px; width:auto; opacity:.92; }
        .brandTitle { font-size: 22px; font-weight: 800; line-height: 1.1; margin: 0; }
        .brandSub { font-size: 12px; opacity: .75; margin-top: 4px; }

        .topRow {
          display:flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .tabRow {
          display:flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .divider {
          height: 1px;
          background: rgba(255,255,255,.12);
          margin: 12px 0 12px;
        }

        .listWrap {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 14px 0 18px;
        }

        /* Card osjećaj za tabelu */
        .tableCard {
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,.16);
          overflow: hidden;
        }

        /* Fino: tabela header ostaje vidljiv dok skrola listWrap */
        .table thead th {
          position: sticky;
          top: 0;
          z-index: 5;
          background: rgba(10,10,10,.35);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .pagerBar {
          display:flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
          flex-wrap: wrap;
        }
        .pagerInfo { opacity: .8; font-size: 12px; }
        .pagerBtns { display:flex; gap:8px; align-items:center; }
      `}</style>

      <div className="pageWrap">
        {/* ✅ TOPBLOCK (glass, sticky) */}
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
                  <div className="brandTitle">Projekti</div>
                  <div className="brandSub">Project &amp; Finance Engine</div>
                </div>
              </div>

              {/* ✅ Tabs samo postavljaju status_pick */}
              <div className="tabRow">
                <Link
                  href={`/projects?status_pick=${encodeURIComponent("group:active")}`}
                  className={`btn ${status_group === "active" && !status_id ? "btn--active" : ""}`}
                  title="Filter: aktivni (1–8)"
                >
                  Aktivni
                </Link>
                <Link
                  href={`/projects?status_pick=${encodeURIComponent("group:archive")}`}
                  className={`btn ${status_group === "archive" && !status_id ? "btn--active" : ""}`}
                  title="Filter: arhiva (10)"
                >
                  Arhiva
                </Link>
                <Link
                  href={`/projects?status_pick=${encodeURIComponent("group:all")}`}
                  className={`btn ${status_group === "all" && !status_id ? "btn--active" : ""}`}
                  title="Filter: svi statusi"
                >
                  Svi projekti
                </Link>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <form method="GET" style={{ width: "100%" }}>
                <input type="hidden" name="page" value="1" />
                <input type="hidden" name="limit" value={String(limit)} />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                    flexWrap: "nowrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <span style={{ opacity: 0.75 }}>Status:</span>

                    <select
                      name="status_pick"
                      defaultValue={statusSelectValue}
                      style={inputStyle}
                    >
                      <option value="group:active">Aktivni (grupa 1–8)</option>
                      <option value="group:archive">Arhiva (samo 10)</option>
                      <option value="group:all">Svi statusi (grupa)</option>
                      <option disabled value="__sep__">
                        ────────
                      </option>
                      {statuses.map((s) => (
                        <option key={s.status_id} value={String(s.status_id)}>
                          {s.status_id} — {s.naziv_statusa}
                        </option>
                      ))}
                    </select>

                    <span style={{ opacity: 0.75 }}>Fin:</span>
                    <select
                      name="fin_status"
                      defaultValue={String(finRaw)}
                      style={inputStyle}
                    >
                      <option value="">Svi</option>
                      <option value="bez_budzeta">Bez budžeta</option>
                      <option value="u_plusu">U plusu</option>
                      <option value="u_minusu">U minusu</option>
                    </select>

                    <span style={{ opacity: 0.75 }}>Legacy:</span>
                    <select
                      name="legacy"
                      defaultValue={String(legacyRaw)}
                      style={inputStyle}
                    >
                      <option value="">Sve</option>
                      <option value="ima_legacy">Ima legacy</option>
                      <option value="nema_legacy">Nema legacy</option>
                    </select>

                    <span style={{ opacity: 0.75 }}>Traži:</span>
                    <input
                      name="q"
                      defaultValue={String(qRaw)}
                      placeholder="ID ili naziv..."
                      style={{ ...inputStyle, width: 220 }}
                    />

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
                        name="show_done"
                        value="1"
                        defaultChecked={showDone}
                      />
                      Prikaži završene
                    </label>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Link
                      href="/naplate"
                      className="btn"
                      style={{
                        padding: "10px 12px",
                        minWidth: 90,
                        textAlign: "center",
                      }}
                    >
                      Naplate
                    </Link>

                    <button
                      type="submit"
                      className="btn"
                      style={{ minWidth: 110 }}
                    >
                      Filtriraj
                    </button>

                    <Link
                      href="/projects"
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

            <div className="divider" />

            {/* ✅ pager info u headeru */}
            <div className="pagerBar">
              <div className="pagerInfo">
                Prikaz: <b>{from}</b>–<b>{to}</b> od <b>{total}</b> (strana{" "}
                {page})
              </div>
              <div className="pagerBtns">
                <Link
                  className={`btn ${hasPrev ? "" : "btn--disabled"}`}
                  href={hasPrev ? `/projects${pageLink(page - 1)}` : "#"}
                  aria-disabled={!hasPrev}
                >
                  ← Prethodna
                </Link>
                <Link
                  className={`btn ${hasNext ? "" : "btn--disabled"}`}
                  href={hasNext ? `/projects${pageLink(page + 1)}` : "#"}
                  aria-disabled={!hasNext}
                >
                  Sljedeća →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ LISTA (skrola) */}
        <div className="listWrap">
          <div className="tableCard">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Radni naziv</th>
                  <th>Rok</th>
                  <th className="num">Budžet</th>
                  <th className="num">Troškovi</th>
                  <th className="num">Zarada</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {projects.map((p) => {
                  const d0 = parseToDateOnly(p?.rok_glavni);
                  const rokText = fmtDDMMYYYY(d0);
                  const diff = computeDaysDiff(d0);
                  const sem = semColor(diff);
                  const label = semLabel(diff);

                  return (
                    <tr key={p.projekat_id}>
                      <td>{p.projekat_id}</td>

                      <td className="cell-wrap">
                        <div>
                          <Link
                            href={`/projects/${p.projekat_id}`}
                            className="project-link"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <img
                              src={
                                p.operativni_signal === "STOP"
                                  ? "/fluxa/Icon_red.png"
                                  : p.operativni_signal === "PAZNJA"
                                    ? "/fluxa/Icon_zuta.png"
                                    : "/fluxa/Icon.png"
                              }
                              alt=""
                              width={18}
                              height={18}
                              style={{ opacity: 0.9 }}
                            />
                            <span>{p.radni_naziv}</span>
                          </Link>

                          {/* ✅ STATUS FLOW (ispod naziva, preko širine ćelije) */}
                          <StatusFlowInline project={p} />
                        </div>
                      </td>

                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span style={{ fontWeight: 650 }}>{rokText}</span>
                          <span
                            title={label}
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              display: "inline-block",
                              background: dotBg(sem),
                              boxShadow: "0 0 0 3px rgba(255,255,255,.06)",
                            }}
                          />
                          <span style={{ opacity: 0.7, fontSize: 12 }}>
                            {label}
                          </span>
                        </div>
                      </td>

                      <td className="num">{fmt(p.budzet_planirani)}</td>
                      <td className="num">{fmt(p.troskovi_ukupno)}</td>
                      <td className="num">{fmt(p.planirana_zarada)}</td>

                      <td>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <SignalBadge project={p} />
                          <span style={{ opacity: 0.45 }}>·</span>
                          <StatusBadge project={p} />
                          <span style={{ opacity: 0.45 }}>·</span>
                          <FinancialBadge project={p} />
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {projects.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ opacity: 0.7, padding: 18 }}>
                      Nema projekata za zadate filtere.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ✅ pager i na dnu */}
          <div className="pagerBar" style={{ paddingTop: 12 }}>
            <div className="pagerInfo">
              Prikaz: <b>{from}</b>–<b>{to}</b> od <b>{total}</b> (strana {page}
              )
            </div>
            <div className="pagerBtns">
              <Link
                className={`btn ${hasPrev ? "" : "btn--disabled"}`}
                href={hasPrev ? `/projects${pageLink(page - 1)}` : "#"}
                aria-disabled={!hasPrev}
              >
                ← Prethodna
              </Link>
              <Link
                className={`btn ${hasNext ? "" : "btn--disabled"}`}
                href={hasNext ? `/projects${pageLink(page + 1)}` : "#"}
                aria-disabled={!hasNext}
              >
                Sljedeća →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
