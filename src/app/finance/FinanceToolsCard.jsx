"use client";

import Link from "next/link";
import { FluxaFeature } from "@/components/FluxaFeature";

/** Feature ID 75 = Finance Tools, vidljivo samo u Full i Compact verziji. */
const FINANCE_TOOLS_FEATURE_ID = 75;

export default function FinanceToolsCard({ title, desc, openLabel }) {
  return (
    <FluxaFeature id={FINANCE_TOOLS_FEATURE_ID}>
      <div
        className="card"
        style={{
          margin: 0,
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
          boxShadow: "var(--shadow)",
          padding: 18,
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.01em" }}>
          {title}
        </div>
        <div className="subtle" style={{ lineHeight: 1.6, marginBottom: 14, fontSize: 13 }}>
          {desc}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn btn--active" href="/studio/finance-tools" style={{ padding: "10px 16px" }}>
            {openLabel}
          </Link>
        </div>
      </div>
    </FluxaFeature>
  );
}
