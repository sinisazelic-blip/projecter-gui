"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

export default function ActivationPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/auth/bootstrap-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, passwordConfirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        if (data?.error === "PASSWORD_MISMATCH") {
          setError("Lozinke se ne podudaraju.");
        } else if (data?.error === "PASSWORD_TOO_SHORT") {
          setError("Lozinka mora imati najmanje 8 karaktera.");
        } else if (data?.error === "PASSWORD_TOO_WEAK") {
          setError("Lozinka je preslaba.");
        } else {
          setError("Promjena lozinke nije uspjela.");
        }
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Greška veze. Pokušajte ponovo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 520,
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "var(--panel)",
          padding: 24,
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 24 }}>
          Postavite novu lozinku
        </h1>
        <p style={{ marginTop: 0, opacity: 0.85, marginBottom: 16 }}>
          Obavezna sigurnosna mjera: prije ulaska u sistem morate promijeniti
          početnu lozinku.
        </p>

        <label
          htmlFor="newPassword"
          style={{ display: "block", marginBottom: 6 }}
        >
          Nova lozinka
        </label>
        <input
          id="newPassword"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 14 }}
          disabled={saving}
        />

        <label
          htmlFor="confirmPassword"
          style={{ display: "block", marginBottom: 6 }}
        >
          Potvrda nove lozinke
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 14 }}
          disabled={saving}
        />

        {error ? (
          <p style={{ color: "var(--danger)", marginTop: 0 }}>{error}</p>
        ) : null}

        <button type="submit" className="btn btn--active" disabled={saving}>
          {saving ? "Spremanje..." : "Spasi i nastavi"}
        </button>
      </form>
    </main>
  );
}
