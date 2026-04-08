import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIE_NAME = "fluxa_session";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/activation",
  "/activation/password",
  "/owner-login",
  "/api/auth/login",
  "/api/auth/fluxa-activate",
  "/api/auth/bootstrap-password",
  "/api/owner/verify",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p)) return true;
  if (pathname.startsWith("/_next") || pathname.startsWith("/fluxa/"))
    return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (isPublicPath(pathname)) {
    if (pathname === "/" && token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  try {
    const [payloadB64] = token.split(".");
    const payloadStr = Buffer.from(payloadB64 || "", "base64url").toString(
      "utf8",
    );
    const parsed = JSON.parse(payloadStr) as { bootstrap?: boolean };
    if (
      parsed.bootstrap === true &&
      parsed.mustChangePassword === true &&
      pathname !== "/activation/password"
    ) {
      return NextResponse.redirect(new URL("/activation/password", req.url));
    }
    if (
      parsed.bootstrap === true &&
      parsed.mustChangePassword !== true &&
      pathname !== "/activation"
    ) {
      return NextResponse.redirect(new URL("/activation", req.url));
    }
    if (parsed.bootstrap !== true && pathname === "/activation") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  } catch {
    // noop
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fluxa/).*)"],
};
