import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          textAlign: "center",
        }}
      >
        <img
          src="/fluxa/logo-light.png"
          alt="Fluxa"
          style={{
            width: 200,
            maxWidth: "90%",
            height: "auto",
            objectFit: "contain",
            opacity: 0.95,
          }}
        />

        <p
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: "var(--muted)",
            textTransform: "uppercase",
          }}
        >
          Projects & Finance Engine
        </p>

        <Link
          href="/dashboard"
          className="btn btn--active"
          style={{
            marginTop: 24,
            padding: "12px 28px",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Uđi u aplikaciju
        </Link>
      </div>
    </main>
  );
}
