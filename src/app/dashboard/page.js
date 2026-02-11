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
      <style>{`
        /* ✅ Fluxa glass style — u duhu /projects */
        .pageWrap {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .topBlock {
          position: sticky;
          top: 0;
          z-index: 30;
          padding: 14px 0 12px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          box-shadow: 0 14px 40px rgba(0,0,0,.22);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .topInner { padding: 0 14px; }

        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandLogo { height: 30px; width:auto; opacity:.92; }
        .brandTitle { font-size: 22px; font-weight: 800; line-height: 1.1; margin: 0; }
        .brandSub { font-size: 12px; opacity: .75; margin-top: 4px; }

        .topRow {
          display:flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .divider {
          height: 1px;
          background: rgba(255,255,255,.12);
          margin: 12px 0 0;
        }

        .bodyWrap {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 14px 0 18px;
        }

        /* Cards */
        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 900px) {
          .grid { grid-template-columns: 1fr; }
        }

        .card {
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,.16);
          padding: 14px;
        }

        .card--legacy {
          border-color: rgba(255, 190, 90, .22);
          background: rgba(255, 190, 90, .06);
        }

        .card--disabled {
          border-color: rgba(255,255,255,.08);
          background: rgba(255,255,255,.02);
        }

        .cardHead { margin-bottom: 10px; }
        .cardTitleRow { display:flex; align-items:center; gap:10px; flex-wrap: wrap; }
        .cardTitle { font-size: 14px; font-weight: 850; letter-spacing: .2px; }
        .cardSub { margin-top: 6px; font-size: 12px; opacity: .72; }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .25px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.05);
          opacity: .9;
        }
        .pill--legacy {
          border-color: rgba(255, 190, 90, .35);
          background: rgba(255, 190, 90, .10);
        }
        .pill--soon {
          border-color: rgba(180, 180, 180, .35);
          background: rgba(180, 180, 180, .10);
        }

        .cardBtns {
          display:flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        /* ✅ btn u vašem sistemu */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 12px;
          min-width: 120px;
          text-align: center;
          white-space: nowrap;
          border-radius: 14px;
          cursor: pointer;
        }

        .btn.btn--disabled,
        .btn[aria-disabled="true"] {
          cursor: not-allowed;
          opacity: .45;
          pointer-events: none;
        }
      `}</style>

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
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
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
