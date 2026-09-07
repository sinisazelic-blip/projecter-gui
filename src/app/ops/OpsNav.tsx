"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: Array<{
  label: string;
  items: Array<{ href: string; label: string; title?: string }>;
}> = [
  {
    label: "Posao",
    items: [
      { href: "/ops/rn", label: "Radni nalozi" },
      { href: "/ops/kompletacija", label: "KC", title: "Kompletacioni centar" },
    ],
  },
  {
    label: "Radionica",
    items: [
      { href: "/ops/sastavnice", label: "Sastavnice" },
      { href: "/ops/nalozi", label: "Radionički nalozi" },
      { href: "/ops/qr", label: "QR" },
    ],
  },
  {
    label: "Magacin",
    items: [
      { href: "/ops/artikli", label: "Šifarnik" },
      { href: "/ops/magacini", label: "Magacini" },
      { href: "/ops/prijemnice", label: "Prijemnice" },
      { href: "/ops/haas", label: "Cjenovnik" },
    ],
  },
  {
    label: "SaaS",
    items: [{ href: "/ops/tenanti", label: "Tenanti" }],
  },
];

export function OpsNav() {
  const path = usePathname() || "";
  return (
    <nav className="opsNav" aria-label="Operativa">
      {GROUPS.map((g) => (
        <div key={g.label} className="opsNavGroup">
          <span className="opsNavLabel">{g.label}</span>
          <div className="opsNavItems">
            {g.items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                title={n.title}
                className={`btn${path.startsWith(n.href) ? " btn--active" : ""}`}
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
      <Link href="/dashboard" className="btn">
        Dashboard
      </Link>
    </nav>
  );
}
