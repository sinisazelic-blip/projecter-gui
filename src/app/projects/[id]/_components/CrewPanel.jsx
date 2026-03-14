"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/components/LocaleProvider";

const MAX_CREW = 12;
const STORAGE_KEY = "fluxa_project_crew_open";

function getStoredOpen() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setStoredOpen(open) {
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {}
}
const CREW_PER_ROW = 6;

const inputStyle = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  outline: "none",
  minWidth: 160,
  fontSize: 14,
};

export default function CrewPanel({
  project,
  crew: initialCrew,
  readOnly,
}) {
  const { t } = useTranslation();
  const [radnici, setRadnici] = useState([]);
  const [crew, setCrew] = useState(() => {
    const list = (initialCrew || []).map((c) => ({
      radnik_id: c.radnik_id,
      ime: c.ime,
      prezime: c.prezime,
    }));
    if (list.length < MAX_CREW) {
      list.push({ radnik_id: null, ime: "", prezime: "" });
    }
    return list;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(getStoredOpen());
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      setStoredOpen(next);
      return next;
    });
  }, []);

  useEffect(() => {
    fetch("/api/radnici/list")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.items)) {
          setRadnici(data.items);
        }
      })
      .catch(() => {});
  }, []);

  const accountManagerName =
    (project?.account_manager_name ?? "").trim() || "—";

  const usedIds = new Set(crew.map((c) => c.radnik_id).filter(Boolean));
  const optionsForSlot = (currentRadnikId) =>
    radnici.filter(
      (r) => !usedIds.has(r.radnik_id) || r.radnik_id === currentRadnikId
    );

  const addCrewSlot = useCallback(() => {
    if (crew.length >= MAX_CREW) return;
    setCrew((prev) => [...prev, { radnik_id: null, ime: "", prezime: "" }]);
  }, [crew.length]);

  const setCrewAt = useCallback((idx, radnikId) => {
    const r = radnici.find((x) => x.radnik_id === radnikId);
    setCrew((prev) => {
      const next = [...prev];
      next[idx] = r
        ? { radnik_id: r.radnik_id, ime: r.ime, prezime: r.prezime }
        : { radnik_id: null, ime: "", prezime: "" };
      if (r && idx === prev.length - 1 && prev.length < MAX_CREW) {
        next.push({ radnik_id: null, ime: "", prezime: "" });
      }
      return next;
    });
  }, [radnici]);

  const removeCrewAt = useCallback((idx) => {
    setCrew((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) {
        next.push({ radnik_id: null, ime: "", prezime: "" });
      }
      return next;
    });
  }, []);

  const saveCrew = useCallback(async () => {
    if (readOnly || !project?.projekat_id) return;
    setSaving(true);
    setMsg(null);
    try {
      const radnikIds = crew
        .map((c) => c.radnik_id)
        .filter((id) => id != null && id > 0);
      const res = await fetch(`/api/projects/${project.projekat_id}/crew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ radnik_ids: radnikIds }),
      });
      const data = await res.json();
      if (data?.ok) {
        setMsg(t("common.save") + " ✓");
        setTimeout(() => setMsg(null), 2000);
      } else {
        setMsg(data?.error || t("common.error"));
      }
    } catch (e) {
      setMsg(e?.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  }, [project?.projekat_id, crew, readOnly, t]);

  const row1 = crew.slice(0, CREW_PER_ROW);
  const row2 = crew.slice(CREW_PER_ROW, MAX_CREW);

  const cellStyle = {
    minWidth: 160,
    flex: "1 1 140px",
  };

  const crewCount = crew.filter((c) => c.radnik_id != null && c.radnik_id > 0).length;

  return (
    <div
      className="card"
      style={{
        opacity: readOnly ? 0.7 : 1,
        pointerEvents: readOnly ? "none" : "auto",
      }}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "none",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          padding: 0,
          marginBottom: expanded ? 12 : 0,
          textAlign: "left",
          fontSize: "inherit",
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 16 }}>
          {t("projectDetail.crewTitle")}
        </span>
        {crewCount > 0 && (
          <span
            className="muted"
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            ({crewCount})
          </span>
        )}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          {expanded ? <ChevronUp size={20} strokeWidth={2} /> : <ChevronDown size={20} strokeWidth={2} />}
        </span>
      </button>

      {/* Uvijek vidljiv: 1 red (Account Manager | Crew 1–6) */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: expanded ? "flex-end" : "center",
          paddingBottom: 8,
          borderBottom: "1px solid rgba(255,255,255,.2)",
        }}
      >
        <div
          style={{
            ...cellStyle,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div className="muted" style={{ fontSize: 12 }}>
            {t("projectDetail.accountManager")}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {accountManagerName}
          </div>
        </div>
        {row1.map((c, colIdx) => {
          const idx = colIdx;
          const name = [c.ime, c.prezime].filter(Boolean).join(" ") || "—";
          return (
            <div
              key={idx}
              style={{
                ...cellStyle,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {expanded && !readOnly ? (
                <>
                  <select
                    value={c.radnik_id ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCrewAt(idx, v ? Number(v) : null);
                    }}
                    style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                  >
                    <option value="">—</option>
                    {optionsForSlot(c.radnik_id).map((r) => (
                      <option key={r.radnik_id} value={r.radnik_id}>
                        {[r.ime, r.prezime].filter(Boolean).join(" ")}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeCrewAt(idx)}
                    title={t("common.close")}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,80,80,.4)",
                      background: "rgba(255,80,80,.1)",
                      color: "inherit",
                      cursor: "pointer",
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                </>
              ) : (
                <div style={{ fontSize: 14, opacity: 0.9 }}>{name}</div>
              )}
            </div>
          );
        })}
      </div>

      {expanded && (
        <>
          {!readOnly && crew.length < MAX_CREW && (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={addCrewSlot}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px dashed rgba(255,255,255,.3)",
                  background: "rgba(255,255,255,.04)",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                + {t("projectDetail.addCrewMember")}
              </button>
            </div>
          )}

          {row2.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <div style={cellStyle} aria-hidden="true" />
              {row2.map((c, colIdx) => {
                const idx = CREW_PER_ROW + colIdx;
                return (
                  <div
                    key={idx}
                    style={{
                      ...cellStyle,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <select
                      value={c.radnik_id ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCrewAt(idx, v ? Number(v) : null);
                      }}
                      style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                    >
                      <option value="">—</option>
                      {optionsForSlot(c.radnik_id).map((r) => (
                        <option key={r.radnik_id} value={r.radnik_id}>
                          {[r.ime, r.prezime].filter(Boolean).join(" ")}
                        </option>
                      ))}
                    </select>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeCrewAt(idx)}
                        title={t("common.close")}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid rgba(255,80,80,.4)",
                          background: "rgba(255,80,80,.1)",
                          color: "inherit",
                          cursor: "pointer",
                          fontSize: 12,
                          flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!readOnly && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 12,
                marginTop: 14,
                paddingTop: 8,
              }}
            >
              {msg && (
                <span style={{ fontSize: 13, opacity: 0.9 }}>{msg}</span>
              )}
              <button
                type="button"
                onClick={saveCrew}
                disabled={saving}
                className="glassbtn payBtn"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(55, 214, 122, 0.2), rgba(34, 197, 94, 0.15))",
                  border: "1px solid rgba(55, 214, 122, 0.45)",
                }}
              >
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
