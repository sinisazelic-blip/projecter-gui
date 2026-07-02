import { query } from "@/lib/db";

export type ClientPaymentStats = {
  invoiceCount: number;
  avgDaysFromIssue: number | null;
  minDaysFromIssue: number | null;
  maxDaysFromIssue: number | null;
};

const PAID_STATUSES = ["PLACENA", "DJELIMICNO", "PAID", "PLACENO"];

export async function getClientPaymentStats(
  klijentId: number,
): Promise<ClientPaymentStats> {
  const id = Number(klijentId);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      invoiceCount: 0,
      avgDaysFromIssue: null,
      minDaysFromIssue: null,
      maxDaysFromIssue: null,
    };
  }

  const rows = (await query(
    `
    SELECT
      COUNT(*) AS invoice_count,
      ROUND(AVG(days_to_pay), 1) AS avg_days,
      MIN(days_to_pay) AS min_days,
      MAX(days_to_pay) AS max_days
    FROM (
      SELECT
        f.faktura_id,
        DATEDIFF(pay.last_payment, f.datum_izdavanja) AS days_to_pay
      FROM fakture f
      INNER JOIN (
        SELECT pr.faktura_id, MAX(pr.datum_prihoda) AS last_payment
        FROM projektni_prihodi pr
        WHERE pr.faktura_id IS NOT NULL
          AND pr.datum_prihoda IS NOT NULL
        GROUP BY pr.faktura_id
      ) pay ON pay.faktura_id = f.faktura_id
      WHERE f.bill_to_klijent_id = ?
        AND f.datum_izdavanja IS NOT NULL
        AND TRIM(UPPER(COALESCE(f.fiskalni_status, ''))) IN (${PAID_STATUSES.map(() => "?").join(", ")})
        AND (f.iznos_ukupno_km IS NULL OR f.iznos_ukupno_km >= 0)
    ) paid
    WHERE days_to_pay IS NOT NULL AND days_to_pay >= 0
    `,
    [id, ...PAID_STATUSES],
  )) as Array<{
    invoice_count: number;
    avg_days: number | null;
    min_days: number | null;
    max_days: number | null;
  }>;

  const row = rows?.[0];
  const invoiceCount = Number(row?.invoice_count ?? 0);

  return {
    invoiceCount,
    avgDaysFromIssue:
      invoiceCount > 0 && row?.avg_days != null ? Number(row.avg_days) : null,
    minDaysFromIssue:
      invoiceCount > 0 && row?.min_days != null ? Number(row.min_days) : null,
    maxDaysFromIssue:
      invoiceCount > 0 && row?.max_days != null ? Number(row.max_days) : null,
  };
}
