"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const USER_LABEL = "SiNY";

type CloseCheck = {
  ok_to_close: boolean;
  hard_blocks: { code: string; message: string; count?: number }[];
  warnings: { code: string; message: string; value?: any }[];
  summary: {
    broj_troskova: number;
    ukupno_km: number;
    zadnji_trosak: string | null;
    budzet_planirani: number | null;
    spent: number;
    over_budget: boolean;
  };
};

function formatKM(n: number) {
  return new Intl.NumberFormat("bs-BA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function toDateShort(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("bs-BA");
}

export function CloseProjectModal({
  open,
  onClose,
  projekatId,
  bankImportHref = "/bank",
}: {
  open: boolean;
  onClose: () => void;
  projekatId: number;
  bankImportHref?: string;
}) {
  const router = useRouter();
  const [data, setData] = React.useState<CloseCheck | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [confirmWarnings, setConfirmWarnings] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const hasHardBlocks = (data?.hard_blocks?.length ?? 0) > 0;
  const hasWarnings = (data?.warnings?.length ?? 0) > 0;

  async function load() {
    setErrorMsg(null);
    setLoading(true);
    setConfirmWarnings(false);
    try {
      const res = await fetch(`/api/projects/${projekatId}/close-check`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setData(null);
        setErrorMsg(j?.error ? String(j.error) : "Greška pri provjeri.");
        return;
      }
      setData(j);
    } catch (e: any) {
      setData(null);
      setErrorMsg(e?.message ?? "Greška pri provjeri.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projekatId]);

  async function doClose() {
    if (!data) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projekatId}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user": USER_LABEL,
        },
        body: JSON.stringify({ force: hasWarnings ? confirmWarnings : true }),
      });
      const j = await res.json();

      if (!res.ok) {
        await load();

        if (j?.error === "CLOSE_BLOCKED") {
          setErrorMsg("Ne može se arhivirati. Provjeri blokade.");
        } else if (j?.error === "CLOSE_NEEDS_CONFIRM") {
          setErrorMsg("Potrebna je potvrda upozorenja (čekiraj).");
        } else {
          setErrorMsg(j?.message ?? j?.error ?? "Greška pri arhiviranju.");
        }
        return;
      }

      onClose();
      router.refresh();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Greška pri arhiviranju.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  // ✅ INLINE (nema fixed overlay, nema popup-a)
  return (
    <div className="w-full rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-3">
        <div className="text-xl font-semibold">Arhivirati projekat?</div>
        <div className="text-sm text-gray-600">
          Nakon arhiviranja projekat je zaključan i izmjene više nisu moguće.
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-center text-gray-600">Učitavam provjeru…</div>
      ) : !data ? (
        <div className="rounded-xl border p-4 text-sm">
          <div className="font-semibold mb-1">Nije moguće učitati provjeru</div>
          <div className="text-gray-700">{errorMsg ?? "—"}</div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="rounded-xl border px-4 py-2 hover:bg-gray-50" onClick={onClose} type="button">
              Zatvori
            </button>
            <button className="rounded-xl bg-black px-4 py-2 text-white" onClick={load} type="button">
              Pokušaj ponovo
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-xl border p-3 mb-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Troškova: <b>{data.summary.broj_troskova}</b></div>
              <div>Spent: <b>{formatKM(Number(data.summary.ukupno_km ?? 0))} KM</b></div>
              <div>Budžet: <b>{data.summary.budzet_planirani == null ? "—" : `${formatKM(Number(data.summary.budzet_planirani))} KM`}</b></div>
              <div>Zadnji trošak: <b>{toDateShort(data.summary.zadnji_trosak)}</b></div>
            </div>
          </div>

          {hasHardBlocks && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="mb-2 font-semibold text-red-800">Ne može se arhivirati</div>
              <ul className="space-y-2 text-sm text-red-900">
                {data.hard_blocks.map((b) => (
                  <li key={b.code} className="flex items-start justify-between gap-3">
                    <span>
                      {b.message}
                      {typeof b.count === "number" ? ` (${b.count})` : ""}
                    </span>

                    {b.code === "BANK_UNCOMMITTED" && (
                      <button
                        className="shrink-0 rounded-lg bg-white px-3 py-1 text-red-800 border border-red-200 hover:bg-red-100"
                        onClick={() => router.push(bankImportHref)}
                        type="button"
                      >
                        Otvori Bank import
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasWarnings && (
            <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-3">
              <div className="mb-2 font-semibold text-yellow-900">Upozorenja</div>
              <ul className="space-y-2 text-sm text-yellow-900">
                {data.warnings.map((w) => (
                  <li key={w.code}>
                    {w.message}
                    {w.code === "OVER_BUDGET" && w.value ? (
                      <span className="block text-xs text-yellow-900/80">
                        Budžet: {formatKM(Number(w.value.budzet_planirani))} KM · Spent: {formatKM(Number(w.value.spent))} KM
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>

              <label className="mt-3 flex items-center gap-2 text-sm">
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
            <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              className="rounded-xl border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
              onClick={onClose}
              type="button"
              disabled={saving}
            >
              Otkaži
            </button>
            <button
              className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-40"
              onClick={doClose}
              type="button"
              disabled={saving || hasHardBlocks || (hasWarnings && !confirmWarnings)}
            >
              Arhiviraj
            </button>
          </div>
        </>
      )}
    </div>
  );
}
