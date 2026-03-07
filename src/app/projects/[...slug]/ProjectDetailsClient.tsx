// src/app/projects/[...slug]/ProjectDetailsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CloseButtonClient } from "./CloseButtonClient";
import { ReadOnlyGuard } from "@/components/ReadOnlyGuard";
import { useTranslation } from "@/components/LocaleProvider";

function money(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("bs-BA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseIdFromPathname(pathname: string): string | null {
  // očekujemo /projects/5688
  const parts = String(pathname || "")
    .split("/")
    .filter(Boolean);
  const i = parts.indexOf("projects");
  const candidate = i >= 0 ? parts[i + 1] : null;
  if (!candidate) return null;
  const s = String(candidate).trim();
  return /^\d+$/.test(s) ? s : null;
}

// Core faza = interni signal za UI (boja), NE prikazujemo kao tekst korisniku.
function getCorePhase(p: any) {
  if (Number(p?.status_id) === 10 || Number(p?.status_id) === 11) return "closed";

  const cf = String(p?.core_faza || "").toLowerCase();
  if (cf === "draft" || cf === "planned" || cf === "active" || cf === "closed")
    return cf;

  const sid = Number(p?.status_id);
  if (sid === 1) return "draft";
  if (sid === 2 || sid === 3 || sid === 11) return "planned";
  if (sid >= 4 && sid <= 9) return "active";
  if (sid === 12) return "closed";
  return "active";
}

function statusNameFallbackById(status_id: any) {
  const sid = Number(status_id);
  return `Status ${sid}`;
}

function getStatusName(p: any, t?: (key: string) => string) {
  const id = p?.status_id;
  if (t != null && id != null) {
    const key = `statuses.project.${id}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  const n = p?.naziv_statusa || p?.status_naziv || p?.status_name;
  if (n) return String(n);
  return statusNameFallbackById(id);
}

function formatAuditAction(a: any) {
  if (!a) return "—";
  if (a === "PROJECT_CLOSE") return "Arhiviran (zatvoren)";
  if (a === "PROJECT_REOPEN") return "Ponovno otvoren";
  return String(a);
}

function formatDateTime(v: any) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("bs-BA");
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error || "Greška pri učitavanju";
    throw new Error(msg);
  }
  return json;
}

export default function ProjectDetailsClient() {
  const { t } = useTranslation();
  const [id, setId] = useState<string | null>(null);

  const [p, setP] = useState<any>(null);
  const [auditLast, setAuditLast] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const pid = parseIdFromPathname(window.location.pathname);
    setId(pid);

    if (!pid) {
      setErr(t("common.invalidProjectId"));
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const pj = await fetchJson(`/api/projects/${pid}`);
        const project = pj?.data;
        setP(project || null);

        const aj = await fetchJson(`/api/projects/${pid}/audit`).catch(() => ({
          data: [],
        }));
        const list = aj?.data || [];
        setAuditLast(Array.isArray(list) && list.length ? list[0] : null);
      } catch (e: any) {
        setErr(e?.message || t("common.loadErrorProject"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const core = useMemo(() => getCorePhase(p), [p]);
  const isClosed = core === "closed";
  const statusName = useMemo(() => getStatusName(p, t), [p, t]);

  if (loading) {
    return (
      <div className="container">
        <div className="card">{t("common.loading")}</div>
      </div>
    );
  }

  if (err || !id) {
    return (
      <div className="container">
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <Link className="btn" href="/projects">
            ← {t("common.back")}
          </Link>
          <h1 style={{ fontSize: 22, margin: 0 }}>{t("common.error")}</h1>
        </div>
        <div className="card">
          {err || t("common.invalidProjectId")}
          <div style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>
            (debug: pathname ={" "}
            {String(
              typeof window !== "undefined" ? window.location.pathname : "",
            )}
            )
          </div>
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="container">
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <Link className="btn" href="/projects">
            ← Nazad
          </Link>
          <h1 style={{ fontSize: 22, margin: 0 }}>Projekat nije pronađen</h1>
        </div>
        <div className="card">Nema podataka za traženi projekat.</div>
      </div>
    );
  }

  // ✅ Tekstualno prikazujemo samo realni status (naziv_statusa).
  // Core faza služi samo za boju badge-a preko data-status.
  const headerBadgeText = statusName;

  return (
    <div className="container">
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link className="btn" href="/projects">
            ← Nazad
          </Link>
          <h1 style={{ fontSize: 22, margin: 0 }}>Projekat #{p.projekat_id}</h1>
          <span className="badge" data-status={core}>
            {headerBadgeText}
          </span>
        </div>

        {!isClosed && (
          <CloseButtonClient projekatId={Number(p.projekat_id)} />
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 8,
            opacity: 0.9,
          }}
        >
          Audit (zadnja akcija)
        </div>
        {!auditLast ? (
          <div style={{ opacity: 0.8 }}>
            Nema audita za ovaj projekat (još).
          </div>
        ) : (
          <div style={{ display: "grid", gap: 4, opacity: 0.9 }}>
            <div>
              <span style={{ opacity: 0.75 }}>Akcija:</span>{" "}
              <b>{formatAuditAction(auditLast.action)}</b>
            </div>
            <div>
              <span style={{ opacity: 0.75 }}>Vrijeme:</span>{" "}
              <b>{formatDateTime(auditLast.created_at)}</b>
            </div>
            <div>
              <span style={{ opacity: 0.75 }}>Korisnik:</span>{" "}
              <b>{auditLast.user_label || "system"}</b>
            </div>
          </div>
        )}
      </div>

      {isClosed && (
        <div
          className="card"
          style={{
            marginBottom: 14,
            borderLeft: "6px solid #111",
            background: "rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Projekat je arhiviran ({statusName})
          </div>
          <div style={{ opacity: 0.85 }}>
            Ovaj projekat je zaključan (read-only). Izmjene troškova i podataka
            nisu dozvoljene.
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          {p.radni_naziv}
        </div>
        <div style={{ opacity: 0.85 }}>
          Finansijski status:{" "}
          <span className="badge" data-status={p.finansijski_status}>
            {p.finansijski_status}
          </span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 10,
            opacity: 0.9,
          }}
        >
          Akcije
        </div>
        <ReadOnlyGuard
          isReadOnly={isClosed}
          reason="Projekat je arhiviran (read-only). Akcije su onemogućene."
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" type="button">
              Dodaj trošak
            </button>
            <button className="btn" type="button">
              Import troškova
            </button>
            <button className="btn" type="button">
              Uredi projekat
            </button>
          </div>
        </ReadOnlyGuard>
      </div>

      <div className="grid">
        <div className="card">
          <div className="kpiLabel">Budžet (plan)</div>
          <div className="kpiValue">{money(p.budzet_planirani)}</div>
        </div>
        <div className="card">
          <div className="kpiLabel">Troškovi (ukupno)</div>
          <div className="kpiValue">{money(p.troskovi_ukupno)}</div>
        </div>
        <div className="card">
          <div className="kpiLabel">Planirana zarada</div>
          <div className="kpiValue">{money(p.planirana_zarada)}</div>
        </div>
      </div>
    </div>
  );
}
