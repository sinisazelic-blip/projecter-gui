import { NextResponse } from "next/server";
import { runLicenceAlertJob } from "@/lib/licence-alerts/job";

export const dynamic = "force-dynamic";

/**
 * Dnevni (ili po želji) cron: upozorenja o licenci / meet kvoti.
 * Zaštita: header `Authorization: Bearer <LICENCE_ALERT_CRON_SECRET>`.
 *
 * Primjer:
 *   curl -sS -X POST -H "Authorization: Bearer $LICENCE_ALERT_CRON_SECRET" \
 *     https://<host>/api/cron/licence-alerts
 */
export async function POST(req: Request) {
  const secret = process.env.LICENCE_ALERT_CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "LICENCE_ALERT_CRON_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization")?.trim() ?? "";
  const lower = auth.toLowerCase();
  const token = lower.startsWith("bearer ")
    ? auth.slice(lower.indexOf("bearer ") + 7).trim()
    : "";
  if (token !== secret) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const result = await runLicenceAlertJob();
  return NextResponse.json({ ok: result.ok, ...result });
}
