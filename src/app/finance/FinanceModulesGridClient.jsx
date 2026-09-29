"use client";

import Link from "next/link";
import { useAuthUser } from "@/components/AuthUserProvider";
import FinanceToolsCard from "./FinanceToolsCard";

export default function FinanceModulesGridClient({ modules, tMap }) {
  const { user, canSee } = useAuthUser();
  const nivo = user?.nivo ?? 0;
  const isOwner = user?.user_id === 0 || user?.username === "Owner" || nivo >= 10;
  const acl = user?.acl;

  const visibleModules = modules.filter((m) => {
    if (isOwner) return true;
    if (m.permModule === "Owner") return isOwner;
    if (acl && Object.keys(acl).length > 0) {
      if (m.key && acl[m.key] !== undefined) {
        return acl[m.key] === "view" || acl[m.key] === "edit";
      }
    }
    return canSee(m.permModule, "");
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 16,
      }}
    >
      {visibleModules.map((m, i) => {
        const title = tMap[m.titleKey] || m.titleKey;
        const desc = tMap[m.descKey] || m.descKey;
        const openLabel = tMap["common.open"] || "Otvori";
        if (m.type === "tools") {
          return <FinanceToolsCard key={i} title={title} desc={desc} openLabel={openLabel} />;
        }
        return (
          <div
            key={i}
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
              <Link className="btn btn--active" href={m.href} style={{ padding: "10px 16px" }}>
                {openLabel}
              </Link>
              {m.href2 ? (
                <Link className="btn" href={m.href2} style={{ padding: "10px 16px" }}>
                  {tMap[m.href2LabelKey] || m.href2LabelKey}
                </Link>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
