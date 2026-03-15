"use client";

import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import FluxaLogo from "@/components/FluxaLogo";
import { uputstvoSekcije } from "./content-sr";
import { uputstvoSekcijeEn } from "./content-en";

const sectionStyle: React.CSSProperties = {
  marginBottom: 32,
  paddingBottom: 24,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  marginBottom: 12,
  color: "rgba(255,255,255,0.95)",
};

const contentStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  color: "rgba(255,255,255,0.85)",
};

const tocLinkStyle: React.CSSProperties = {
  display: "block",
  padding: "8px 12px",
  borderRadius: 8,
  color: "rgba(255,255,255,0.85)",
  textDecoration: "none",
  fontSize: 14,
  marginBottom: 4,
};

export default function UputstvoPage() {
  const { locale } = useTranslation();
  const sekcije = locale === "en" ? uputstvoSekcijeEn : uputstvoSekcije;
  const pageTitle = locale === "en" ? "User Manual" : "Uputstvo";
  const pageSubtitle = locale === "en" ? "User manual for using Fluxa" : "Korisničko uputstvo za korištenje Fluxe";
  const tocLabel = locale === "en" ? "Contents" : "Sadržaj";

  return (
    <div className="container" style={{ minHeight: "100vh" }}>
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <h1 className="brandTitle">{pageTitle}</h1>
                  <div className="brandSub">{pageSubtitle}</div>
                </div>
              </div>
              <div className="actions">
                <Link href="/dashboard" className="btn">
                  <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> Dashboard
                </Link>
              </div>
            </div>
            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <div
            className="uputstvoGrid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(180px, 220px) 1fr",
              gap: 32,
              alignItems: "start",
              maxWidth: 1000,
              margin: "0 auto",
            }}
          >
            <nav
              className="uputstvoNav"
              style={{
                position: "sticky",
                top: 20,
                padding: "16px 0",
                borderRight: "1px solid rgba(255,255,255,0.08)",
                paddingRight: 24,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {tocLabel}
              </div>
              {sekcije.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  style={tocLinkStyle}
                  className="uputstvo-mutedHover"
                >
                  {s.title}
                </a>
              ))}
            </nav>

            <main style={{ paddingTop: 8 }}>
              {sekcije.map((s) => (
                <section key={s.id} id={s.id} style={sectionStyle}>
                  <h2 style={titleStyle}>{s.title}</h2>
                  <div
                    style={contentStyle}
                    className="uputstvoContent"
                    dangerouslySetInnerHTML={{ __html: s.content }}
                  />
                </section>
              ))}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
