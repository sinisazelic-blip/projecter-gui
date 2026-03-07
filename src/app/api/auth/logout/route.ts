import { NextResponse } from "next/server";
import { getSessionCookieAttributes, COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return res;
}
