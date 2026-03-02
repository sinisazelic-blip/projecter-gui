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
        🏠 {dashboardLabel}
      </Link>
    </div>
  );
}
