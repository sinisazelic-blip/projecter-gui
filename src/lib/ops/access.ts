import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import {
  COOKIE_NAME,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/session";
import { isEnterInstance } from "@/lib/fluxa-instance";

export function requireEnterPage(): void {
  if (!isEnterInstance()) redirect("/dashboard");
}

export async function requireEnterApi(): Promise<
  { error: NextResponse; session?: undefined } | { error: null; session: SessionPayload }
> {
  if (!isEnterInstance()) {
    return {
      error: NextResponse.json({ ok: false, error: "NOT_ENTER" }, { status: 404 }),
    };
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session) {
    return {
      error: NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }
  return { error: null, session };
}
