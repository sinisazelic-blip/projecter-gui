function pad2(n) {
  const s = String(n ?? "");
  return s.length === 1 ? "0" + s : s;
}

function isValidDate(d) {
  return d instanceof Date && Number.isFinite(d.getTime());
}

// pokušaj: Date | "YYYY-MM-DD" | "YYYY-MM-DD HH:mm:ss" | ISO | "MM/DD/YYYY"
function parseToDateOnly(v) {
  if (!v) return null;

  // 1) Date objekt
  if (v instanceof Date && isValidDate(v)) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }

  const s0 = String(v).trim();
  if (!s0) return null;

  // 2) ako počinje sa YYYY-MM-DD, uzmi prvih 10
  const s = s0.slice(0, 10);
  const mIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (mIso) {
    const y = Number(mIso[1]);
    const mo = Number(mIso[2]);
    const d = Number(mIso[3]);
    return new Date(y, mo - 1, d);
  }

  // 3) MM/DD/YYYY (US)
  const mUs = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s0.slice(0, 10));
  if (mUs) {
    const mo = Number(mUs[1]);
    const d = Number(mUs[2]);
    const y = Number(mUs[3]);
    return new Date(y, mo - 1, d);
  }

  // 4) fallback: Date.parse (ISO ili slično)
  const d = new Date(s0);
  if (isValidDate(d)) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

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

/**
 * ✅ Operativni signal (NORMALNO/PAZNJA/STOP) — owner odluka, vidljivo timu kroz UI
 * Samo prikaz (ne utiče ni na šta).
 */
function normalizeSignal(sigRaw) {
  const s = String(sigRaw ?? "NORMALNO")
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
      bg: "rgba(255, 80, 80, .16)",
      border: "rgba(255, 80, 80, .40)",
      dot: "rgba(255, 80, 80, .95)",
      title: "STOP — STANI / eskaliraj",
    };
  }
  if (sig === "PAZNJA") {
    return {
      label: "PAŽNJA",
      bg: "rgba(255, 165, 0, .16)",
      border: "rgba(255, 165, 0, .40)",
      dot: "rgba(255, 165, 0, .95)",
      title: "PAŽNJA — pripremi se",
    };
  }
  return {
    label: "NORMALNO",
    bg: "rgba(80, 220, 140, .14)",
    border: "rgba(80, 220, 140, .38)",
    dot: "rgba(80, 220, 140, .95)",
    title: "NORMALNO — sve ide po planu",
  };
}

/**
 * ✅ Read-only status label (kanonski)
 * Prefer: project.naziv_statusa (iz statusi_projekta join-a),
 * Fallback: map po status_id (minimalno, da ne pukne UI).
 */
function statusLabelFallbackById(status_id) {
  const sid = Number(status_id);

  // ⚠️ Ovo je fallback samo da UI ne bude prazan.
  // Kanon je statusi_projekta.naziv_statusa.
  const map = {
    1: "Draft",
    2: "Planned",
    3: "Active",
    4: "Invoiced",
    5: "Closed",
    6: "Archived",
    10: "Imported",
  };

  return map[sid] || `Status ${sid || "—"}`;
}

function getReadOnlyStatusLabel(project) {
  const n =
    project?.naziv_statusa || project?.status_naziv || project?.status_name;
  if (n) return String(n);
  return statusLabelFallbackById(project?.status_id);
}

export default function ProjectHeader({ project, hideTitle }) {
  const dateOnly = parseToDateOnly(project?.rok_glavni);
  const rokText = fmtDDMMYYYY(dateOnly);
  const daysDiff = computeDaysDiff(dateOnly);

  const sem = semColor(daysDiff);
  const label = semLabel(daysDiff);

  const dotBg =
    sem === "red"
      ? "rgba(255, 80, 80, .95)"
      : sem === "orange"
        ? "rgba(255, 165, 0, .95)"
        : sem === "green"
          ? "rgba(80, 220, 140, .95)"
          : "rgba(180, 180, 180, .85)";

  const sig = normalizeSignal(project?.operativni_signal);
  const sigM = signalMeta(sig);

  const statusLabel = getReadOnlyStatusLabel(project);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "baseline",
      }}
    >
      <div>
        {!hideTitle && (
          <h1 style={{ fontSize: 22, marginBottom: 6 }}>
            #{project.projekat_id} — {project.radni_naziv}
          </h1>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* ✅ Operativni signal */}
          <span
            title={sigM.title}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 999,
              border: `1px solid ${sigM.border}`,
              background: sigM.bg,
              fontWeight: 750,
              letterSpacing: 0.3,
              lineHeight: 1,
              whiteSpace: "nowrap",
              marginTop: 10,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: sigM.dot,
                boxShadow: "0 0 0 3px rgba(255,255,255,.06)",
                display: "inline-block",
              }}
            />
            {sigM.label}
          </span>

          <div
            title="Prihvaćeni rok iz Deal-a"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.18)",
              background: "rgba(255,255,255,.05)",
              marginTop: 10,
            }}
          >
            <span className="muted" style={{ fontSize: 12 }}>
              Rok:
            </span>

            <span style={{ fontWeight: 650 }}>{rokText}</span>

            {/* ✅ SEMAFOR: uvijek prikazan (ako ne znamo diff -> sivo) */}
            <span
              aria-label="Semafor roka"
              title={label}
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                display: "inline-block",
                background: dotBg,
                boxShadow: "0 0 0 3px rgba(255,255,255,.06)",
              }}
            />

            <span className="muted" style={{ fontSize: 12 }}>
              {label}
            </span>
          </div>
        </div>
      </div>

      <span className="badge" data-status={project.finansijski_status}>
        {project.finansijski_status}
      </span>
    </div>
  );
}
