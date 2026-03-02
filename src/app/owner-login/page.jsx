"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STORAGE_KEY = "FLUXA_OWNER_TOKEN";

export default function OwnerLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [alreadyOwner, setAlreadyOwner] = useState(false);
  const [expectedLength, setExpectedLength] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY)) {
      setAlreadyOwner(true);
    }
  }, []);

  useEffect(() => {
    fetch("/api/owner/verify")
      .then((r) => r.json())
      .then((d) => {
        if (d.configured && typeof d.expectedLength === "number") {
          setExpectedLength(d.expectedLength);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/owner/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();

      if (data.ok) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, token.trim());
        }
        router.push("/dashboard");
        return;
      }

      if (res.status === 503 && data.error === "OWNER_NOT_CONFIGURED") {
        setError("Owner nije konfigurisan na serveru (FLUXA_OWNER_TOKEN).");
        return;
      }
      let errMsg = "Pogrešna šifra. Pokušaj ponovo.";
      if (data.debug) {
        if (data.debug.hint) errMsg += " " + data.debug.hint;
        if (data.debug.diffIndex != null && data.debug.expectedCharCode != null && data.debug.gotCharCode != null) {
          errMsg += ` [na poziciji ${data.debug.diffIndex}: server=${data.debug.expectedCharCode}, uneseno=${data.debug.gotCharCode}]`;
        }
      }
      setError(errMsg);
    } catch (err) {
      setError("Greška u vezi. Pokušaj ponovo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          padding: "32px 28px",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          Owner prijava
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          Unesi owner šifru da ovaj računar bude označen kao Owner. Stanje se
          pamti do odjave ili brisanja podataka stranice.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <label
              htmlFor="owner-token"
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--muted)",
                marginBottom: 6,
              }}
            >
              Owner šifra (FLUXA_OWNER_TOKEN)
            </label>
            <input
              id="owner-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="current-password"
              placeholder="Unesi šifru"
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: 15,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                boxSizing: "border-box",
              }}
            />
            {expectedLength != null && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>
                Server očekuje {expectedLength} znakova.
              </p>
            )}
          </div>

          {error && (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--danger, #f87171)",
              }}
            >
              {error}
              {error.includes("Pogrešna") && !error.includes("na poziciji") && (
                <span style={{ display: "block", marginTop: 6, fontWeight: "normal" }}>
                  Ako šifra sadrži + ili specijalne znakove, u .env.local stavi je pod navodnicima pa restartuj server.
                </span>
              )}
            </p>
          )}

          <button
            type="submit"
            className="btn btn--active"
            disabled={loading || !token.trim()}
            style={{
              padding: "12px 20px",
              fontSize: 15,
              fontWeight: 600,
              width: "100%",
              marginTop: 4,
            }}
          >
            {loading ? "Provjera…" : "Potvrdi — postani Owner"}
          </button>
        </form>

        <p style={{ margin: "20px 0 0", fontSize: 12, color: "var(--muted)" }}>
          <Link href="/dashboard" style={{ color: "var(--link)" }}>
            ← Nazad na Dashboard
          </Link>
        </p>

        {alreadyOwner && (
          <p style={{ margin: "16px 0 0", fontSize: 12, color: "var(--muted)" }}>
            Na ovom računaru već si prijavljen kao Owner.{" "}
            <button
              type="button"
              className="btn"
              style={{ fontSize: 12, padding: "4px 10px" }}
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem(STORAGE_KEY);
                  setAlreadyOwner(false);
                }
              }}
            >
              Odjavi owner
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
