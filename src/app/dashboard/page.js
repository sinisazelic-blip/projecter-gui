// src/app/dashboard/page.js
import Link from "next/link";

export const dynamic = "force-dynamic";

const GROUPS = [
  {
    title: "Operativa",
    sub: "Brzi ulaz u glavne liste. (Deal → Projekti)",
    items: [
      { label: "Dealovi (lista)", href: "/inicijacije" },
      { label: "Projekti (lista)", href: "/projects" },
    ],
  },
  {
    title: "Finansije (operativa)",
    sub: "Operativni finansijski tokovi (email / fakture / naplate).",
    items: [
      { label: "Narudžbenice", href: "/narudzbenice" },
      {
        label: "Interna blagajna (owner)",
        href: "/cash",
        title: "Interna blagajna — owner-only signal",
      },

      // ✅ aktiviramo wizard entry
      {
        label: "Fakture",
        href: "/fakture/za-fakturisanje",
        title: "Za fakturisanje → wizard",
      },

      { label: "Naplata (novi modul)", href: null },
      { label: "Dugovanja", href: null },
      { label: "Import izvoda", href: null },
      { label: "Izvještaji", href: null },
    ],
    tone: "disabled",
  },
  {
    title: "Studio / Šifarnici",
    sub: "Studio šifarnici (kanonske rute).",
    items: [
      { label: "Firma (identitet)", href: "/studio/firma" },
      { label: "Cjenovnik", href: "/studio/cjenovnik" },
      { label: "Talenti", href: "/studio/talenti" },
      { label: "Dobavljači", href: "/studio/dobavljaci" },
      { label: "Klijenti", href: "/studio/klijenti" },
    ],
  },
  {
    title: "Finansije (legacy)",
    sub: "Ranije napravljeno — korisno kasnije, vjerovatno traži doradu.",
    tone: "legacy",
    items: [
      { label: "Finance", href: "/finance" },
      { label: "Naplate", href: "/naplate" },
      { label: "Finance Tools", href: "/studio/finance-tools" },
    ],
  },
];

function ActionBtn({ label, href, title }) {
  if (!href) {
    return (
      <span
        className="btn btn--disabled"
        aria-disabled="true"
        title={title || "Još nije implementirano"}
      >
        {label}
      </span>
    );
  }
  return (
    <Link className="btn" href={href} title={title || label}>
      {label}
    </Link>
  );
}

function GroupCard({ group }) {
  const tone = String(group?.tone || "");
  const legacy = tone === "legacy";
  const disabled = tone === "disabled";

  return (
    <div
      className={`card ${legacy ? "card--legacy" : ""} ${disabled ? "card--disabled" : ""}`}
    >
      <div className="cardHead">
        <div className="cardTitleRow">
          <div className="cardTitle">{group.title}</div>
          {legacy && <span className="pill pill--legacy">legacy</span>}
          {disabled && <span className="pill pill--soon">operativa</span>}
        </div>
        {group.sub ? <div className="cardSub">{group.sub}</div> : null}
      </div>

      <div className="cardBtns">
        {group.items.map((it) => (
          <ActionBtn
            key={it.label}
            label={it.label}
            href={it.href}
            title={it.title}
          />
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <img
                  src="/fluxa/logo-light.png"
                  alt="FLUXA"
                  className="brandLogo"
                />
                <div>
                  <div className="brandTitle">Dashboard</div>
                  <div className="brandSub">
                    Tok: Deal → Projekti → Finansije
                  </div>
                </div>
              </div>

              {/* ✅ TOPBAR: samo Blagajna */}
              <div className="actions">
                <Link
                  href="/cash"
                  className="btn"
                  title="Interna blagajna (owner-only signal)"
                >
                  Blagajna
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <div className="grid">
            {GROUPS.map((g) => (
              <GroupCard key={g.title} group={g} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
