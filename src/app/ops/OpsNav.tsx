"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  {
    label: "Magacin",
    items: [
      { href: "/ops/artikli", label: "Šifarnik" },
      { href: "/ops/magacini", label: "Magacini" },
      { href: "/ops/prijemnice", label: "Prijemnice" },
    ],
  },
  {
    label: "Proizvodnja",
    items: [
      { href: "/ops/sastavnice", label: "Sastavnice" },
      { href: "/ops/nalozi", label: "Nalozi" },
      { href: "/ops/qr", label: "QR" },
    ],
  },
  {
    label: "Posao",
    items: [
      { href: "/ops/kompletacija", label: "Sken" },
      { href: "/ops/haas", label: "HaaS" },
      { href: "/ops/tenanti", label: "Tenanti" },
    ],
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
