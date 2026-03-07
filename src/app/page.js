import Link from "next/link";
import LoginForm from "./LoginForm";
import FluxaLogo from "@/components/FluxaLogo";

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
        <FluxaLogo
          className=""
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
        <Link
          href="/owner-login"
          style={{
            marginTop: 8,
            fontSize: 13,
            color: "var(--muted)",
            textDecoration: "none",
            opacity: 0.9,
          }}
          title="Unesite owner šifru za pristup verziji Fluxe i dodatnim opcijama"
        >
          Owner pristup
        </Link>
      </div>
    </main>
  );
}
