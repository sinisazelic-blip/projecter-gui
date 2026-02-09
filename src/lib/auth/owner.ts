// src/lib/auth/owner.ts
import { NextRequest } from "next/server";

export function assertOwner(req: NextRequest) {
  const expected = process.env.FLUXA_OWNER_TOKEN;

  if (!expected) {
    // Fail-closed: ako token nije podešen, niko nije owner.
    throw new Error("FLUXA_OWNER_TOKEN is not set");
  }

  const got = req.headers.get("x-owner-token");
  if (!got || got !== expected) {
    const err: any = new Error("OWNER_ONLY");
    err.status = 403;
    throw err;
  }
}
