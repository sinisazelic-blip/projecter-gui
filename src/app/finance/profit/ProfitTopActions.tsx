"use client";

import Link from "next/link";

export default function ProfitTopActions({
  printLabel,
  printTitle,
  dashboardLabel,
}: {
  printLabel: string;
  printTitle: string;
  dashboardLabel: string;
}) {
  return (
    <div className="profitActions">
      <button
        type="button"
        className="btn no-print"
        onClick={() => window.print()}
        title={printTitle}
      >
        🖨️ {printLabel}
      </button>
      <Link href="/dashboard" className="btn" title={dashboardLabel}>
        <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {dashboardLabel}
      </Link>
    </div>
  );
}
