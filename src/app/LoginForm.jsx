"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";

export default function LoginForm({ isDemoInstance = false }) {
  const { t } = useTranslation();
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
        const text = await res.text();
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          const snippet = text.slice(0, 120).replace(/\s+/g, " ");
          setError(
            `Server nije vratio JSON (${res.status}). ${snippet ? `Odgovor: "${snippet}…"` : "Prazan odgovor."} ` +
              "Provjeri env (DB_*, AUTH_SECRET) i logove na hostingu."
          );
          return;
        }
      } catch (parseErr) {
        setError("Greška pri čitanju odgovora. Provjeri mrežu i logove na hostingu.");
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
      const text = await res.text();
      let data = { ok: false, error: "" };
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        const snippet = text.slice(0, 120).replace(/\s+/g, " ");
        setError(`Server nije vratio JSON (${res.status}). ${snippet ? `Odgovor: "${snippet}…"` : "Prazan odgovor."}`);
        return;
      }
      if (data.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      if (res.status === 503) {
        if (data.error === "DEMO_NOT_CONFIGURED") {
          setError("Demo baza nije konfigurirana (postavi DEMO_DB_NAME u env-u na hostingu).");
          return;
        }
        if (data.error === "DEMO_DB_ERROR") {
          setError("Greška pri pristupu demo bazi: " + (data.message || "provjeri DEMO_DB_NAME i da baza postoji."));
          return;
        }
      }
      if (res.status === 401) {
        if (data.error === "DEMO_USER_MISSING") {
          setError("U demo bazi nema korisnika demo. Pokreni seed: node scripts/seed-demo.js (prema bazi iz DEMO_DB_NAME).");
          return;
        }
        setError("Demo nalog nije dostupan. U demo bazi mora postojati korisnik demo (seed: node scripts/seed-demo.js).");
        return;
      }
      setError(data.message || data.error || "Greška pri demo prijavi. Pokušaj ponovo.");
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
      {isDemoInstance && (
        <div
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            fontSize: 14,
            color: "var(--muted)",
            textAlign: "center",
            fontFamily: "monospace",
          }}
        >
          {t("login.credentialsHint")}
        </div>
      )}
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
          {t("login.labelUsername")}
        </label>
        <input
          id="login-user"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder={t("login.placeholderUsername")}
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
          {t("login.labelPassword")}
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder={t("login.placeholderPassword")}
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
        {loading ? t("login.submitLoading") : t("login.submit")}
      </button>

      {!isDemoInstance && (
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
      )}
    </form>
  );
}
