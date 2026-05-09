import { query } from "@/lib/db";
import {
  buildLicenceAlertSignature,
  describeAlertTags,
  resolveExpiryAlertTag,
  resolveMeetAlertTag,
} from "@/lib/licence-alerts/thresholds";

export type LicenceAlertJobResult = {
  ok: boolean;
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
};

type TenantAlertRow = {
  tenant_id: number;
  naziv: string;
  status: string;
  billing_email: string | null;
  billing_phone: string | null;
  last_licence_alert_at: string | null;
  last_licence_alert_key: string | null;
  soccs_tier: string | null;
  days_until_end: number;
  meet_remaining: number;
};

const TENANT_SELECT = `SELECT
  t.tenant_id,
  t.naziv,
  t.status,
  t.billing_email,
  t.billing_phone,
  DATE_FORMAT(t.last_licence_alert_at, '%Y-%m-%d %H:%i:%s') AS last_licence_alert_at,
  t.last_licence_alert_key,
  t.soccs_tier,
  DATEDIFF(t.subscription_ends_at, CURDATE()) AS days_until_end,
  (
    SELECT COUNT(*)
    FROM soccs_activation_codes sac
    WHERE sac.tenant_id = t.tenant_id
      AND sac.purpose = 'MEET_SESSION'
      AND UPPER(sac.status) = 'ISSUED'
      AND (sac.valid_until IS NULL OR sac.valid_until >= NOW())
  ) AS meet_remaining
FROM tenants t
WHERE UPPER(TRIM(t.status)) = 'AKTIVAN'`;

async function dispatchLicenceAlert(
  payload: Record<string, unknown>,
): Promise<boolean> {
  const url = process.env.LICENCE_ALERT_WEBHOOK_URL?.trim();
  if (!url) {
    console.log(
      "[licence-alerts] LICENCE_ALERT_WEBHOOK_URL nije postavljen — dry run:",
      JSON.stringify(payload),
    );
    return true;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  return res.ok;
}

export async function runLicenceAlertJob(): Promise<LicenceAlertJobResult> {
  const errors: string[] = [];
  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  let rows: TenantAlertRow[];
  try {
    rows = await query<TenantAlertRow>(TENANT_SELECT);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(msg);
    return {
      ok: false,
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors,
    };
  }

  for (const row of rows ?? []) {
    processed += 1;
    const email = String(row.billing_email ?? "").trim();
    const phone = String(row.billing_phone ?? "").trim();
    if (!email && !phone) {
      skipped += 1;
      continue;
    }

    const days = Number(row.days_until_end);
    const meetRem = Number(row.meet_remaining ?? 0);
    const hasSoccs = Boolean(String(row.soccs_tier ?? "").trim());

    const expiryTag = resolveExpiryAlertTag(days);
    const meetTag = resolveMeetAlertTag(meetRem, hasSoccs);
    const signature = buildLicenceAlertSignature([expiryTag, meetTag]);
    if (!signature) {
      skipped += 1;
      continue;
    }

    const prevKey = String(row.last_licence_alert_key ?? "").trim();
    if (prevKey === signature) {
      skipped += 1;
      continue;
    }

    const tags = [expiryTag, meetTag].filter(Boolean) as string[];
    const reasons = describeAlertTags(tags);

    const payload = {
      kind: "fluxa_licence_alert",
      tenant_id: row.tenant_id,
      tenant_name: row.naziv,
      billing_email: email || null,
      billing_phone: phone || null,
      days_until_end: days,
      meet_remaining: meetRem,
      tags,
      reasons,
      signature,
    };

    try {
      const ok = await dispatchLicenceAlert(payload);
      if (!ok) {
        failed += 1;
        errors.push(`tenant ${row.tenant_id}: webhook HTTP greška`);
        continue;
      }
      await query(
        `UPDATE tenants SET last_licence_alert_at = NOW(), last_licence_alert_key = ? WHERE tenant_id = ?`,
        [signature, row.tenant_id],
      );
      sent += 1;
    } catch (e) {
      failed += 1;
      errors.push(
        `tenant ${row.tenant_id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    processed,
    sent,
    skipped,
    failed,
    errors,
  };
}
