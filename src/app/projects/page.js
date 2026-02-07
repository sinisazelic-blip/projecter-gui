// src/app/projects/page.js
import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Project status badge helpers
 */
function normalizeProjectStatus(project) {
  const raw =
    project?.status ??
    project?.status_name ??
    project?.status_naziv ??
    project?.statusStatus ??
    project?.status_id ??
    project?.statusId;

  if (raw === null || raw === undefined) return "unknown";

  if (typeof raw === "number") {
    const map = { 1: "draft", 2: "planned", 3: "active", 4: "closed", 6: "archived" };
    return map[raw] ?? "unknown";
  }

  const s = String(raw).trim().toLowerCase();
  if (["draft", "nacrt"].includes(s)) return "draft";
  if (["planned", "planirano", "plan", "dogovoreno", "u_planu"].includes(s)) return "planned";
  if (["active", "aktivan", "u_toku", "otvoren"].includes(s)) return "active";
  if (["closed", "zatvoren", "storniran", "zavrsen", "završen", "invoiced", "fakturisan", "fakturisan"].includes(s))
    return "closed";
  if (["archived", "arhiviran", "arhiva"].includes(s)) return "archived";
  return "unknown";
}

function projectStatusMeta(status) {
  switch (status) {
    case "draft":
      return { label: "DRAFT", className: "status-badge--draft" };
    case "planned":
      return { label: "PLANNED", className: "status-badge--planned" };
    case "active":
      return { label: "ACTIVE", className: "status-badge--active" };
    case "closed":
      return { label: "CLOSED", className: "status-badge--closed" };
    case "archived":
      return { label: "ARCHIVED", className: "status-badge--draft" };
    default:
      return { label: "UNKNOWN", className: "status-badge--unknown" };
  }
}

function StatusBadge({ project }) {
  const status = normalizeProjectStatus(project);
  const meta = projectStatusMeta(status);

  const rawLabel =
    project?.status_naziv ??
    project?.status_name ??
    project?.status ??
    (project?.status_id ? `status_id=${project.status_id}` : "");

  return (
    <span
      className={`status-badge ${meta.className}`}
      title={rawLabel ? `Status: ${rawLabel}` : `Status: ${status}`}
    >
      <span className="status-badge__dot" />
      {meta.label}
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
    <span className={`fin-badge ${meta.className}`} title={`Fin status: ${fin}`}>
      <span className="fin-badge__dot" />
      {meta.label}
    </span>
  );
}

/**
 * ✅ Operativni signal (NORMALNO/PAZNJA/STOP) — “vidi se iz aviona”
 * Prikaz u STATUS koloni (ne posebna kolona).
 */
function normalizeSignal(project) {
  const raw = project?.operativni_signal;
  const s = String(raw ?? "NORMALNO").trim().toUpperCase();
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
  if (isValidDate(d)) return new Date(d.getFullYear(), d.getMonth(), d.getDate());

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

// ✅ sortiranje po master contextu
function sortProjects(rows, statusVal) {
  const list = Array.isArray(rows) ? [...rows] : [];

  if (String(statusVal) === "3") {
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

  if (String(statusVal) === "6") {
    list.sort((a, b) => Number(a?.projekat_id ?? 0) - Number(b?.projekat_id ?? 0));
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

export default async function Page({ searchParams }) {
  const sp = await Promise.resolve(searchParams);

  const statusIdRaw = sp?.status_id ?? "";
  const finRaw = sp?.fin_status ?? "";
  const legacyRaw = sp?.legacy ?? "";
  const qRaw = sp?.q ?? "";
  const showDoneRaw = sp?.show_done ?? "";
  const showDone = String(showDoneRaw) === "1";

  const statusVal = String(statusIdRaw || "3");

  const statuses = await query(`SELECT status_id, naziv FROM statusi ORDER BY status_id ASC`);

  const qs = buildQuery({
    status_id: statusVal,
    fin_status: finRaw,
    legacy: legacyRaw,
    q: qRaw,
    show_done: showDone ? "1" : "",
  });

  // ✅ ključ: no-store fetch, bez apiGet helpera koji može keširati
  const json = await apiGetNoStore(`/api/projects${qs}`);
  const projectsRaw = json?.rows ?? [];
  const projects = sortProjects(projectsRaw, statusVal);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        /* ✅ Minimal “glass” kozmetika (Fluxa official) */
        .pageWrap {
          display: flex;
          flex-direction: column;
          height: 100%;
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
      `}</style>

      <div className="pageWrap">
        {/* ✅ TOPBLOCK (glass, sticky) */}
        <div style={{ flex: "0 0 auto" }}>
          <div className="container">
            <div className="topBlock">
              <div className="topInner">
                <div className="topRow">
                  <div className="brandWrap">
                    <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
                    <div>
                      <div className="brandTitle">Projekti</div>
                      <div className="brandSub">Project &amp; Finance Engine</div>
                    </div>
                  </div>

                  <div className="tabRow">
                    <Link href="/projects?status_id=3" className={`btn ${statusVal === "3" ? "btn--active" : ""}`}>
                      Aktivni
                    </Link>
                    <Link href="/projects?status_id=6" className={`btn ${statusVal === "6" ? "btn--active" : ""}`}>
                      Arhiva
                    </Link>
                    <Link href="/projects?status_id=all" className={`btn ${statusVal === "all" ? "btn--active" : ""}`}>
                      Svi projekti
                    </Link>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <form method="GET" style={{ width: "100%" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        flexWrap: "nowrap",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                        <span style={{ opacity: 0.75 }}>Status:</span>

                        <select name="status_id" defaultValue={statusVal} style={inputStyle}>
                          <option value="3">Aktivni (default)</option>
                          <option value="all">Svi statusi</option>
                          {statuses.map((s) => (
                            <option key={s.status_id} value={s.status_id}>
                              {s.naziv}
                            </option>
                          ))}
                        </select>

                        <span style={{ opacity: 0.75 }}>Fin:</span>
                        <select name="fin_status" defaultValue={String(finRaw)} style={inputStyle}>
                          <option value="">Svi</option>
                          <option value="bez_budzeta">Bez budžeta</option>
                          <option value="u_plusu">U plusu</option>
                          <option value="u_minusu">U minusu</option>
                        </select>

                        <span style={{ opacity: 0.75 }}>Legacy:</span>
                        <select name="legacy" defaultValue={String(legacyRaw)} style={inputStyle}>
                          <option value="">Sve</option>
                          <option value="ima_legacy">Ima legacy</option>
                          <option value="nema_legacy">Nema legacy</option>
                        </select>

                        <span style={{ opacity: 0.75 }}>Traži:</span>
                        <input name="q" defaultValue={String(qRaw)} placeholder="ID ili naziv..." style={{ ...inputStyle, width: 220 }} />

                        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, opacity: 0.9 }}>
                          <input type="checkbox" name="show_done" value="1" defaultChecked={showDone} />
                          Prikaži završene
                        </label>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                        <Link href="/naplate" className="btn" style={{ padding: "10px 12px", minWidth: 90, textAlign: "center" }}>
                          Naplate
                        </Link>

                        <button type="submit" className="btn" style={{ minWidth: 110 }}>
                          Filtriraj
                        </button>

                        <Link href="/projects" className="btn" style={{ padding: "10px 12px", minWidth: 90, textAlign: "center" }}>
                          Reset
                        </Link>
                      </div>
                    </div>
                  </form>
                </div>

                <div className="divider" />
              </div>
            </div>
          </div>
        </div>

        {/* ✅ LISTA (skrola) */}
        <div className="listWrap">
          <div className="container">
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
                    const isArchived = String(p.status_id) === "6";

                    const d0 = parseToDateOnly(p?.rok_glavni);
                    const rokText = fmtDDMMYYYY(d0);
                    const diff = computeDaysDiff(d0);
                    const sem = semColor(diff);
                    const label = semLabel(diff);

                    return (
                      <tr key={p.projekat_id} data-closed={isArchived ? "1" : "0"}>
                        <td>{p.projekat_id}</td>

                        <td className="cell-wrap">
                          <Link
                            href={`/projects/${p.projekat_id}`}
                            className="project-link"
                            style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
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
                        </td>

                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
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
                            <span style={{ opacity: 0.7, fontSize: 12 }}>{label}</span>
                          </div>
                        </td>

                        <td className="num">{fmt(p.budzet_planirani)}</td>

                        <td className="num">{fmt(p.troskovi_ukupno)}</td>

                        <td className="num">{fmt(p.planirana_zarada)}</td>

                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
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
          </div>
        </div>
      </div>
    </div>
  );
}
