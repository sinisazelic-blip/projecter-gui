"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

export default function FluxaActivationPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!companyName.trim() || !activationCode.trim()) {
      setError("Unesite naziv firme i aktivacijski kod.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/fluxa-activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          activationCode: activationCode.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        if (data?.error === "INVALID_CODE") {
          setError(
            "Kod nije validan ili je neaktivan. Provjerite kod i pokušajte ponovo.",
          );
        } else if (data?.error === "VERIFY_NETWORK_ERROR") {
          setError("Greška veze prema master Fluxi. Pokušajte ponovo.");
        } else {
          setError("Aktivacija nije uspjela.");
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
          Aktivacija FLUXA instance
        </h1>
        <p style={{ marginTop: 0, opacity: 0.85, marginBottom: 16 }}>
          Unesite naziv firme i aktivacijski kod koji ste dobili ugovorom.
        </p>

        <label
          htmlFor="companyName"
          style={{ display: "block", marginBottom: 6 }}
        >
          Naziv firme
        </label>
        <input
          id="companyName"
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 14 }}
          disabled={saving}
        />

        <label
          htmlFor="activationCode"
          style={{ display: "block", marginBottom: 6 }}
        >
          Aktivacijski kod
        </label>
        <input
          id="activationCode"
          type="text"
          value={activationCode}
          onChange={(e) => setActivationCode(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 14 }}
          disabled={saving}
        />

        {error ? (
          <p style={{ color: "var(--danger)", marginTop: 0 }}>{error}</p>
        ) : null}

        <button type="submit" className="btn btn--active" disabled={saving}>
          {saving ? "Aktivacija..." : "Aktiviraj"}
        </button>
      </form>
    </main>
  );
}
