"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./CashClient.module.css";

type CashDirection = "IN" | "OUT";

type CashEntry = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  direction: CashDirection;
  note: string;
  projectId: string | null;
  status: "DRAFT";
  createdAt: string;
};

type CashResponse = {
  ok: boolean;
  balance: number;
  items: CashEntry[];
  error?: string;
};

const LS_OWNER_TOKEN_KEY = "fluxa_owner_token";

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function fmtMoney(amount: number, currency: string) {
  return `${Number(amount).toFixed(2)} ${currency}`;
}

export default function CashClient() {
  const [ownerToken, setOwnerToken] = useState<string>("");
  const [loadedToken, setLoadedToken] = useState(false);

  const [data, setData] = useState<CashResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form
  const [amount, setAmount] = useState<string>("");
  const [direction, setDirection] = useState<CashDirection>("OUT");
  const [currency, setCurrency] = useState<string>("KM");
  const [note, setNote] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");

  const canUse = useMemo(() => ownerToken.trim().length > 0, [ownerToken]);

  useEffect(() => {
    const tok = window.localStorage.getItem(LS_OWNER_TOKEN_KEY) || "";
    setOwnerToken(tok);
    setLoadedToken(true);
  }, []);

  function saveToken() {
    window.localStorage.setItem(LS_OWNER_TOKEN_KEY, ownerToken.trim());
  }

  function clearToken() {
    window.localStorage.removeItem(LS_OWNER_TOKEN_KEY);
    setOwnerToken("");
    setData(null);
    setErr(null);
  }

  async function fetchCash() {
    const tok = ownerToken.trim();
    if (!tok) {
      setErr("Unesi owner token.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/cash", {
        method: "GET",
        headers: { "x-owner-token": tok },
        cache: "no-store",
      });

      const text = await res.text();
      const json = text ? (JSON.parse(text) as CashResponse) : null;

      if (!res.ok) {
        const msg =
          (json && typeof json === "object" && (json as any).error) ||
          `HTTP ${res.status}`;
        throw new Error(msg);
      }

      setData(json);
    } catch (e: any) {
      setData(null);
      setErr(e?.message || "Greška pri učitavanju.");
    } finally {
      setLoading(false);
    }
  }

  async function saveAndFetch() {
    if (!ownerToken.trim()) {
      setErr("Unesi owner token.");
      return;
    }
    saveToken();
    await fetchCash();
  }

  async function createDraft() {
    const tok = ownerToken.trim();
    if (!tok) {
      setErr("Unesi owner token.");
      return;
    }

    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Iznos mora biti broj > 0.");
      return;
    }
    if (!note.trim()) {
      setErr("Bilješka je obavezna.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const payload = {
        amount: n,
        direction,
        currency: currency.trim() || "KM",
        note: note.trim(),
        projectId: projectId.trim() ? projectId.trim() : null,
      };

      const res = await fetch("/api/cash", {
        method: "POST",
        headers: {
          "x-owner-token": tok,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok) {
        const msg =
          (json && typeof json === "object" && json.error) || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      setAmount("");
      setNote("");
      setProjectId("");
      await fetchCash();
    } catch (e: any) {
      setErr(e?.message || "Greška pri upisu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loadedToken) return;
    if (ownerToken.trim()) fetchCash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedToken]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Cash (Blagajna)</div>
        <div className={styles.subtitle}>
          Signalni sloj (append-only, DRAFT). Ne utiče na banku/ledger.
        </div>
      </div>

      {err ? <div className={styles.error}>{err}</div> : null}

      <div className={styles.card}>
        <div className={styles.row}>
          <div className={styles.grow}>
            <div className={styles.label}>Owner token (localStorage)</div>
            <input
              className={styles.input}
              value={ownerToken}
              onChange={(e) => setOwnerToken(e.target.value)}
              placeholder="FLUXA_OWNER_TOKEN"
            />
          </div>

          <button
            className={styles.btnPrimary}
            onClick={saveAndFetch}
            disabled={!ownerToken.trim() || loading}
          >
            {loading ? "..." : "Sačuvaj & Učitaj"}
          </button>

          <button className={styles.btn} onClick={clearToken} type="button">
            Obriši token
          </button>

          <button
            className={styles.btn}
            onClick={fetchCash}
            disabled={!canUse || loading}
            type="button"
          >
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.label}>Saldo (DRAFT)</div>
          <div className={styles.big}>
            {data ? fmtMoney(data.balance ?? 0, "KM") : "—"}
          </div>
          <div className={styles.muted}>
            Unosa: <b>{data?.items?.length ?? 0}</b>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>Quick add (DRAFT)</div>

          <div className={styles.formGrid}>
            <div>
              <div className={styles.label}>Iznos</div>
              <input
                className={styles.input}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="npr. 50"
              />
            </div>

            <div>
              <div className={styles.label}>Smjer</div>
              <select
                className={styles.input}
                value={direction}
                onChange={(e) => setDirection(e.target.value as CashDirection)}
              >
                <option value="OUT">OUT (trošak)</option>
                <option value="IN">IN (priliv)</option>
              </select>
            </div>

            <div>
              <div className={styles.label}>Valuta</div>
              <input
                className={styles.input}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="KM"
              />
            </div>

            <div>
              <div className={styles.label}>Bilješka (obavezno)</div>
              <input
                className={styles.input}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="npr. gorivo"
              />
            </div>

            <div className={styles.full}>
              <div className={styles.label}>Project ID (opciono)</div>
              <input
                className={styles.input}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="project id (za sad ručno)"
              />
            </div>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.btnPrimary}
              onClick={createDraft}
              disabled={!canUse || loading}
            >
              {loading ? "..." : "Dodaj DRAFT"}
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>Unosi</div>

          {!data?.items?.length ? (
            <div className={styles.muted}>Nema unosa.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Smjer</th>
                    <th>Iznos</th>
                    <th>Bilješka</th>
                    <th>ProjectId</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.id}>
                      <td>{fmtDate(it.date)}</td>
                      <td className={styles.bold}>{it.direction}</td>
                      <td>{fmtMoney(it.amount, it.currency)}</td>
                      <td>{it.note}</td>
                      <td>{it.projectId ?? "—"}</td>
                      <td>{it.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.footerNote}>
            Privremena interna ruta (/cash) dok ne napravimo centralnu konzolu.
          </div>
        </div>
      </div>
    </div>
  );
}
