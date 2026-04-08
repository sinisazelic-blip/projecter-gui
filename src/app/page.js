import Link from "next/link";
import { headers } from "next/headers";
import LoginForm from "./LoginForm";
import FluxaLogo from "@/components/FluxaLogo";

function isDemoInstanceHost(host) {
  if (!host || typeof host !== "string") return false;
  return host.includes("demo.studiotaf.xyz") || host.startsWith("demo.");
}

export default async function HomePage() {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const isDemoInstance = isDemoInstanceHost(host);

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
          FLUXA V2.0
        </p>

        <LoginForm isDemoInstance={isDemoInstance} />
        {!isDemoInstance && (
        <Link
          href="/owner-login"
          style={{
            marginTop: 8,
            fontSize: 13,
            color: "var(--muted)",
            textDecoration: "none",
            opacity: 0.9,
          }}
          title="Enter owner password for full Fluxa version and extra options"
        >
          Owner access
        </Link>
        )}
      </div>
    </main>
  );
}
