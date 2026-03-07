import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "fluxa_session";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/owner-login",
  "/api/auth/login",
  "/api/owner/verify",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p)) return true;
  if (pathname.startsWith("/_next") || pathname.startsWith("/fluxa/")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    if (pathname === "/" && req.cookies.get(COOKIE_NAME)?.value) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!req.cookies.get(COOKIE_NAME)?.value) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fluxa/).*)"],
};
