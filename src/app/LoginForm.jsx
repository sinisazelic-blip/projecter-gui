"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      let data = { ok: false, error: "" };
      try {
        data = await res.json();
      } catch {
        setError("Greška od servera (nije JSON). Provjeri terminal gdje radi npm run dev.");
        return;
      }

      if (data.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      if (res.status === 401 && data.error === "INVALID_CREDENTIALS") {
        setError("Pogrešno korisničko ime ili lozinka.");
        return;
      }
      if (res.status === 500) {
        if (data.error === "MISSING_AUTH_SECRET") {
          setError("U .env.local dodaj: AUTH_SECRET=neka_tajna_duga_min_16_znakova pa restartuj server (Ctrl+C, npm run dev).");
          return;
        }
        setError("Greška na serveru. Otvori terminal (npm run dev) i pogledaj poruku greške.");
        return;
      }
      setError("Greška pri prijavi. Pokušaj ponovo.");
    } catch {
      setError("Greška u vezi (mreža ili server ne odgovara). Je li pokrenut npm run dev?");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "demo", password: "demo" }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "" }));
      if (data.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      if (res.status === 503 && data.error === "DEMO_NOT_CONFIGURED") {
        setError("Demo baza nije konfigurirana (postavi DEMO_DB_NAME u env-u na hostingu).");
        return;
      }
      if (res.status === 401) {
        setError("Demo nalog nije dostupan. U demo bazi mora postojati korisnik demo (seed: node scripts/seed-demo.js).");
        return;
      }
      setError("Greška pri demo prijavi. Pokušaj ponovo.");
    } catch {
      setError("Greška u vezi. Je li server pokrenut?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        marginTop: 28,
        width: "100%",
        maxWidth: 320,
      }}
    >
      <div style={{ width: "100%" }}>
        <label
          htmlFor="login-user"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--muted)",
            marginBottom: 6,
            textAlign: "left",
          }}
        >
          Korisničko ime
        </label>
        <input
          id="login-user"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder="Korisničko ime"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 15,
          }}
        />
      </div>
      <div style={{ width: "100%" }}>
        <label
          htmlFor="login-password"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--muted)",
            marginBottom: 6,
            textAlign: "left",
          }}
        >
          Lozinka
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="Lozinka"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 15,
          }}
        />
      </div>

      {error && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--danger, #f87171)", width: "100%" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn btn--active"
        disabled={loading}
        style={{
          marginTop: 8,
          padding: "12px 28px",
          fontSize: 15,
          fontWeight: 600,
          width: "100%",
          maxWidth: 200,
        }}
      >
        {loading ? "Prijava…" : "Prijava"}
      </button>

      <button
        type="button"
        onClick={handleDemoLogin}
        disabled={loading}
        className="btn"
        style={{
          marginTop: 4,
          padding: "10px 20px",
          fontSize: 14,
          width: "100%",
          maxWidth: 200,
          background: "transparent",
          border: "1px solid var(--border, #333)",
          color: "var(--muted)",
        }}
        title="Prijava u demo bazu (korisnik demo / lozinka demo)"
      >
        Pogledaj demo
      </button>
    </form>
  );
}
