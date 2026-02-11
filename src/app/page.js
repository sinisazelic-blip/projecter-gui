export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        backgroundColor: "#0f172a", // dark slate
        color: "#e5e7eb", // light text
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Studio TAF · Fluxa</h1>

      <p style={{ opacity: 0.85 }}>Početni GUI ekran — radi.</p>

      <div style={{ marginTop: 16, opacity: 0.75 }}>
        <p>
          Napomena: Fluxa je nova platforma (proJECTer je stara
          Excel/platforma).
        </p>
      </div>
    </main>
  );
}
