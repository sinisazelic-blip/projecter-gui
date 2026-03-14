"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Login page uvijek na engleskom – "ulazna vrata", bez čekanja na prevod. */
const L = {
  credentialsHint: "To access the DEMO version, enter: demo / demo",
  labelUsername: "Username",
  placeholderUsername: "Enter username",
  labelPassword: "Password",
  placeholderPassword: "Enter password",
  submit: "Sign in",
  submitLoading: "Signing in…",
};

export default function LoginForm({ isDemoInstance = false }) {
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
            `Server did not return JSON (${res.status}). ${snippet ? `Response: "${snippet}…"` : "Empty response."} ` +
              "Check env (DB_*, AUTH_SECRET) and hosting logs."
          );
          return;
        }
      } catch (parseErr) {
        setError("Error reading response. Check network and hosting logs.");
        return;
      }

      if (data.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      if (res.status === 401 && data.error === "INVALID_CREDENTIALS") {
        setError("Invalid username or password.");
        return;
      }
      if (res.status === 500) {
        if (data.error === "MISSING_AUTH_SECRET") {
          setError("Add AUTH_SECRET to .env.local (min 16 chars) and restart server (Ctrl+C, npm run dev).");
          return;
        }
        setError("Server error. Open terminal (npm run dev) and check the error message.");
        return;
      }
      setError("Login error. Please try again.");
    } catch {
      setError("Connection error (network or server not responding). Is npm run dev running?");
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
        setError(`Server did not return JSON (${res.status}). ${snippet ? `Response: "${snippet}…"` : "Empty response."}`);
        return;
      }
      if (data.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      if (res.status === 503) {
        if (data.error === "DEMO_NOT_CONFIGURED") {
          setError("Demo database not configured (set DEMO_DB_NAME in hosting env).");
          return;
        }
        if (data.error === "DEMO_DB_ERROR") {
          setError("Demo database error: " + (data.message || "check DEMO_DB_NAME and that the database exists."));
          return;
        }
      }
      if (res.status === 401) {
        if (data.error === "DEMO_USER_MISSING") {
          setError("Demo user missing in database. Run seed: node scripts/seed-demo.js (against DEMO_DB_NAME).");
          return;
        }
        setError("Demo account unavailable. Demo user must exist in database (seed: node scripts/seed-demo.js).");
        return;
      }
      setError(data.message || data.error || "Demo login error. Please try again.");
    } catch {
      setError("Connection error. Is the server running?");
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
          {L.credentialsHint}
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
          {L.labelUsername}
        </label>
        <input
          id="login-user"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder={L.placeholderUsername}
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
          {L.labelPassword}
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder={L.placeholderPassword}
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
        {loading ? L.submitLoading : L.submit}
      </button>

      {!isDemoInstance && (
        <a
          href="https://demo.studiotaf.xyz/"
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
            textDecoration: "none",
            textAlign: "center",
            display: "block",
            boxSizing: "border-box",
          }}
          title="View demo at demo.studiotaf.xyz (user: demo / password: demo)"
        >
          View demo
        </a>
      )}
    </form>
  );
}
