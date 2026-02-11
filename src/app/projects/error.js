"use client";

export default function Error({ error, reset }) {
  return (
    <div className="container">
      <h1 style={{ fontSize: 22, marginBottom: 14 }}>Projekti</h1>

      <div className="card">
        <div style={{ marginBottom: 10 }}>Greška pri učitavanju projekata.</div>

        <div style={{ opacity: 0.8, marginBottom: 12, fontSize: 13 }}>
          {error?.message || "Nepoznata greška"}
        </div>

        <button className="btn" onClick={() => reset()}>
          Pokušaj ponovo
        </button>
      </div>
    </div>
  );
}
