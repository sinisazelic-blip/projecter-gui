"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type OverrideState = {
  override_id: number;
  reason: string;
  expires_at: string;
  enabled_by_username: string | null;
} | null;

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    const err: any = new Error(data?.error || `HTTP ${res.status}`);
    err.payload = data;
    throw err;
  }
  return data;
}

/**
 * Owner/admin: privremeno otključaj troškove na Fakturisanom projektu
 * (isti project_edit_overrides mehanizam kao Deal override).
 */
export default function ProjectCostOverridePanel({
  projekatId,
  initialState,
}: {
  projekatId: number;
  initialState: OverrideState;
}) {
  const router = useRouter();
  const [state, setState] = useState<OverrideState>(initialState);
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasOverride = !!state;

  async function enable() {
    const r = reason.trim();
    const m = Number(minutes);
    if (!r) {
      setError("Unesi razlog za otključavanje troškova.");
      return;
    }
    if (!Number.isFinite(m) || m < 5 || m > 240) {
      setError("Trajanje mora biti između 5 i 240 minuta.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const j = await fetchJson(`/api/projects/${projekatId}/edit-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: r, minutes: Math.trunc(m) }),
      });
      setState((j?.state ?? null) as OverrideState);
      setReason("");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Ne mogu aktivirati override.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/projects/${projekatId}/edit-override`, {
        method: "DELETE",
      });
      setState(null);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Ne mogu ugasiti override.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        border: "1px solid rgba(80, 170, 255, .45)",
        background: "rgba(80, 170, 255, .10)",
      }}
    >
      <div style={{ fontWeight: 850, marginBottom: 6 }}>
        Admin override — troškovi
      </div>
      <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>
        Projekat je fakturisan (read-only). Override privremeno dozvoljava ispravku
        troškova (iznos/saradnik). Iznos prema klijentu i dalje se mijenja samo u
        Deal-u.
      </div>

      {hasOverride ? (
        <>
          <div style={{ fontSize: 13, opacity: 0.95, marginBottom: 10 }}>
            Aktivno do: <b>{state?.expires_at ?? "—"}</b>
            {" · "}
            razlog: <b>{state?.reason ?? "—"}</b>
            {state?.enabled_by_username ? (
              <>
                {" · "}
                uključio: <b>{state.enabled_by_username}</b>
              </>
            ) : null}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="glassbtn actionBtn"
              onClick={disable}
              disabled={busy}
            >
              {busy ? "Gasim..." : "Isključi override"}
            </button>
          </div>
        </>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 120px auto",
            gap: 8,
            alignItems: "center",
          }}
        >
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Razlog (npr. storno fakture / ispravka honorara)"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.18)",
              background: "rgba(0,0,0,.25)",
              color: "inherit",
            }}
          />
          <input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="min"
            inputMode="numeric"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.18)",
              background: "rgba(0,0,0,.25)",
              color: "inherit",
            }}
          />
          <button
            type="button"
            className="glassbtn actionBtn"
            onClick={enable}
            disabled={busy}
          >
            {busy ? "Aktiviram..." : "Uključi override"}
          </button>
        </div>
      )}

      {error ? (
        <div style={{ marginTop: 8, color: "#ff4d4d", fontSize: 13 }}>{error}</div>
      ) : null}
    </div>
  );
}
