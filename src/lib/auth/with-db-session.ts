import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/session";
import { runWithSession } from "@/lib/db";

/**
 * Za API rute koje koriste bazu: osigurava da query()/pool koriste ispravan pool (demo vs studio)
 * prema session.isDemo. Dohvati session iz cookie i pokreni handler unutar runWithSession.
 */
export async function withDbSession(
  req: NextRequest,
  handler: (req: NextRequest, session: SessionPayload | null) => Promise<NextResponse>
): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? null;
  const session = token ? verifySessionToken(token) : null;
  return runWithSession(session, () => handler(req, session));
}
