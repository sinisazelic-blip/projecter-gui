// src/app/projects/[id]/_components/FinalOkButtonClient.tsx
"use client";

import * as React from "react";
import { Flag } from "lucide-react";

const USER_LABEL = "SiNY";

type FinalOkCheck = {
  ok_to_final: boolean;
  hard_blocks: { code: string; message: string }[];
  warnings: { code: string; message: string; value?: any }[];
  summary: {
    status_id: number;
    status_name: string | null;
    budzet_planirani: number | null;
    troskovi_ukupno: number;
    over_budget: boolean;
  };
};

function formatKM(n: number) {
  return new Intl.NumberFormat("bs-BA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...(init || {}) });
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = j?.message || j?.error || "Greška.";
    const err: any = new Error(msg);
    err.payload = j;
    err.status = res.status;
    throw err;
  }
  return j;
}

export default function FinalOkButtonClient({
  projekatId,
  disabled = false,
}: {
  projekatId: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [data, setData] = React.useState<FinalOkCheck | null>(null);
  const [confirmWarnings, setConfirmWarnings] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const hasHardBlocks = (data?.hard_blocks?.length ?? 0) > 0;
  const hasWarnings = (data?.warnings?.length ?? 0) > 0;

  async function load() {
    setErrorMsg(null);
    setLoading(true);
    setConfirmWarnings(false);
    try {
      const j = await fetchJson(`/api/projects/${projekatId}/final-ok-check`);
      // j: { ok:true, ...payload }
      setData(j as any);
    } catch (e: any) {
      setData(null);
      setErrorMsg(e?.message ?? "Greška pri provjeri.");
    } finally {
      setLoading(false);
    }
  }

  async function doFinalOk() {
    if (!data) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await fetchJson(`/api/projects/${projekatId}/final-ok`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user": USER_LABEL,
        },
        body: JSON.stringify({ force: hasWarnings ? confirmWarnings : true }),
      });

      // nakon uspjeha: zatvori, refresh
      setOpen(false);
      // refresh stranice (najjednostavnije i najpouzdanije)
      window.location.reload();
    } catch (e: any) {
      const payload = e?.payload;
      if (payload?.error === "FINAL_BLOCKED") {
        setErrorMsg("Ne može se upisati FINAL OK. Provjeri blokade.");
      } else if (payload?.error === "FINAL_NEEDS_CONFIRM") {
        setErrorMsg("Potrebna je potvrda upozorenja (čekiraj).");
      } else {
        setErrorMsg(e?.message ?? "Greška pri FINAL OK.");
      }

      // osvježi check
      try {
        await load();
      } catch {}
    } finally {
      setSaving(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projekatId]);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="glassbtn payBtn"
        title={disabled ? "Projekat je read-only." : "Produkcija završena → FINAL OK (status: Završen)"}
        onClick={() => setOpen(true)}
        disabled={disabled}
        style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}
      >
        <Flag size={16} />
        FINAL OK
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 10px)",
            width: 360,
            maxWidth: "90vw",
            zIndex: 50,
            border: "1px solid rgba(255,255,255,.18)",
            background: "rgba(20,20,30,.92)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 14px 40px rgba(0,0,0,.35)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
              <Flag size={16} />
              FINAL OK
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => setOpen(false)}
              disabled={saving}
              title="Zatvori"
            >
              ✕
            </button>
          </div>

          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
            Ovo znači: produkcija je završena. Projekat prelazi u status <b>Završen</b> (bez zaključavanja) i spreman je
            za komunikaciju s klijentom.
          </div>

          <div style={{ marginTop: 12 }}>
            {loading ? (
              <div style={{ opacity: 0.85 }}>Učitavam provjeru…</div>
            ) : !data ? (
              <div style={{ opacity: 0.9 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Nije moguće učitati provjeru</div>
                <div style={{ opacity: 0.9 }}>{errorMsg ?? "—"}</div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                  <button className="btn" type="button" onClick={() => setOpen(false)} disabled={saving}>
                    Zatvori
                  </button>
                  <button className="btn" type="button" onClick={load} disabled={saving}>
                    Pokušaj ponovo
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    border: "1px solid rgba(255,255,255,.14)",
                    borderRadius: 12,
                    padding: 10,
                    background: "rgba(255,255,255,.04)",
                  }}
                >
                  <div style={{ display: "grid", gap: 6, fontSize: 13, opacity: 0.92 }}>
                    <div>
                      Status sada:{" "}
                      <b>{data.summary.status_name ? data.summary.status_name : `#${data.summary.status_id}`}</b>
                    </div>
                    <div>
                      Budžet:{" "}
                      <b>
                        {data.summary.budzet_planirani == null
                          ? "—"
                          : `${formatKM(Number(data.summary.budzet_planirani))} KM`}
                      </b>
                    </div>
                    <div>
                      Troškovi: <b>{formatKM(Number(data.summary.troskovi_ukupno ?? 0))} KM</b>
                    </div>
                  </div>
                </div>

                {hasHardBlocks && (
                  <div
                    style={{
                      marginTop: 12,
                      border: "1px solid rgba(255,80,80,.35)",
                      background: "rgba(255,80,80,.10)",
                      padding: 10,
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Ne može se upisati FINAL OK</div>
                    <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 6, fontSize: 13 }}>
                      {data.hard_blocks.map((b) => (
                        <li key={b.code}>{b.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {hasWarnings && (
                  <div
                    style={{
                      marginTop: 12,
                      border: "1px solid rgba(255,165,0,.35)",
                      background: "rgba(255,165,0,.10)",
                      padding: 10,
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Upozorenja</div>
                    <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 6, fontSize: 13 }}>
                      {data.warnings.map((w) => (
                        <li key={w.code}>
                          {w.message}
                          {w.code === "OVER_BUDGET" && w.value ? (
                            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 3 }}>
                              Budžet: {formatKM(Number(w.value.budzet_planirani))} KM · Troškovi:{" "}
                              {formatKM(Number(w.value.troskovi_ukupno))} KM
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={confirmWarnings}
                        onChange={(e) => setConfirmWarnings(e.target.checked)}
                        disabled={saving}
                      />
                      Razumijem i želim nastaviti
                    </label>
                  </div>
                )}

                {errorMsg && (
                  <div
                    style={{
                      marginTop: 10,
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(255,255,255,.06)",
                      padding: 10,
                      borderRadius: 12,
                      fontSize: 13,
                      opacity: 0.95,
                    }}
                  >
                    {errorMsg}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                  <button className="btn" type="button" onClick={() => setOpen(false)} disabled={saving}>
                    Otkaži
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={doFinalOk}
                    disabled={saving || hasHardBlocks || (hasWarnings && !confirmWarnings)}
                    title="Upiši FINAL OK (status = Završen)"
                  >
                    {saving ? "Snima…" : "Upiši FINAL OK"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
