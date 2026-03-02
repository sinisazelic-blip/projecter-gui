"use client";

import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();

  function handleSubmit(e) {
    e.preventDefault();
    // Kad bude aktivan user management, ovdje: provjera credentials, session, itd.
    router.push("/dashboard");
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
          User
        </label>
        <input
          id="login-user"
          type="text"
          name="user"
          autoComplete="username"
          placeholder="User"
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
          Password
        </label>
        <input
          id="login-password"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Password"
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 15,
          }}
        />
      </div>
      <button
        type="submit"
        className="btn btn--active"
        style={{
          marginTop: 8,
          padding: "12px 28px",
          fontSize: 15,
          fontWeight: 600,
          width: "100%",
          maxWidth: 200,
        }}
      >
        Enter
      </button>
    </form>
  );
}
