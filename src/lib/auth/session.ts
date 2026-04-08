import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "fluxa_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 dana

export type SessionPayload = {
  user_id: number;
  username: string;
  role_id: number | null;
  nivo: number;
  bootstrap?: boolean;
  mustChangePassword?: boolean;
  /** true = svi DB upiti idu na demo bazu (DEMO_DB_NAME); false ili nedefinirano = studio baza (DB_NAME) */
  isDemo?: boolean;
  exp: number;
};

function getSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  if (!s || s.length < 16)
    throw new Error("AUTH_SECRET or SESSION_SECRET (min 16 chars) required");
  return s;
}

function sign(payload: string): string {
  const secret = getSecret();
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  return hmac.digest("base64url");
}

export function createSessionToken(
  payload: Omit<SessionPayload, "exp">,
): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const full: SessionPayload = { ...payload, exp };
  const payloadStr = JSON.stringify(full);
  const payloadB64 = Buffer.from(payloadStr, "utf8").toString("base64url");
  const sig = sign(payloadStr);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    const expectedSig = sign(payloadStr);
    if (expectedSig.length !== sig.length) return null;
    if (
      !timingSafeEqual(
        Buffer.from(expectedSig, "utf8"),
        Buffer.from(sig, "utf8"),
      )
    )
      return null;
    const data = JSON.parse(payloadStr) as SessionPayload;
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function getSessionCookieAttributes(): {
  name: string;
  maxAge: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
} {
  return {
    name: COOKIE_NAME,
    maxAge: MAX_AGE_SEC,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };
}

export { COOKIE_NAME };
