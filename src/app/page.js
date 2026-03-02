import LoginForm from "./LoginForm";

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
            width: 260,
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
          }}
        >
          Project & Finance Engine
        </p>

        <LoginForm />
      </div>
    </main>
  );
}
