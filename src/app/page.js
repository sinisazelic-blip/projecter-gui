import Link from "next/link";
import LoginForm from "./LoginForm";
import FluxaLogo from "@/components/FluxaLogo";
import { FLUXA_BUILD_LABEL } from "@/lib/fluxaVersion";
import { isEnterInstance } from "@/lib/fluxa-instance";

export default async function HomePage() {
  const enter = isEnterInstance();
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
          {enter ? "Deal, Ops & Finance" : "Project & Finance Engine"}
        </p>
        <p
          style={{
            margin: 0,
            marginTop: -8,
            fontSize: 12,
            letterSpacing: "0.08em",
            color: "var(--muted)",
            opacity: 0.7,
          }}
        >
          {FLUXA_BUILD_LABEL}
        </p>

        <LoginForm />
        <Link
          href="/owner-login"
          style={{
            marginTop: 4,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            color: "var(--muted)",
            textDecoration: "none",
            opacity: 0.45,
          }}
          aria-label="OA"
        >
          OA
        </Link>
      </div>
    </main>
  );
}
