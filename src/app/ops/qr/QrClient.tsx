"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { OpsArtikal, OpsJedinicaOpreme } from "@/lib/ops/schema";

export default function QrClient({
  artikli,
  jediniceOpreme = [],
}: {
  artikli: OpsArtikal[];
  jediniceOpreme?: OpsJedinicaOpreme[];
}) {
  const printable = artikli.filter((a) => a.aktivan);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const rows = artikli.filter((a) => a.aktivan);
    (async () => {
      const next: Record<string, string> = {};
      for (const a of rows) {
        next[`a-${a.artikal_id}`] = await QRCode.toDataURL(a.sifra, {
          width: 180,
          margin: 1,
        });
      }
      for (const e of jediniceOpreme) {
        next[`e-${e.jedinica_id}`] = await QRCode.toDataURL(e.kod, {
          width: 180,
          margin: 1,
        });
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [artikli, jediniceOpreme]);

  return (
    <div>
      <p style={{ fontSize: 13, opacity: 0.8 }}>
        QR šifarnika nosi šifru artikla. Ako postoje primljene serije opreme,
        ispod su njihove naljepnice (npr. TTS-ZONA-000001).
      </p>
      <button
        type="button"
        className="btn"
        style={{ marginBottom: 16 }}
        onClick={() => window.print()}
      >
        Štampaj
      </button>
      <div
        className="ops-qr-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        {printable.map((a) => (
          <div
            key={a.artikal_id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 12,
              textAlign: "center",
              background: "#fff",
              color: "#111",
            }}
          >
            {urls[`a-${a.artikal_id}`] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urls[`a-${a.artikal_id}`]}
                alt={a.sifra}
                style={{ width: 140, height: 140 }}
              />
            ) : (
              <div style={{ height: 140 }}>…</div>
            )}
            <div style={{ fontWeight: 800, fontSize: 13 }}>{a.sifra}</div>
            <div style={{ fontSize: 11 }}>{a.naziv}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>{a.vrsta}</div>
          </div>
        ))}
      </div>
      {jediniceOpreme.length ? (
        <>
          <h3 style={{ margin: "28px 0 12px" }}>Serije opreme</h3>
          <div
            className="ops-qr-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            {jediniceOpreme.map((e) => (
              <div
                key={e.jedinica_id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 12,
                  textAlign: "center",
                  background: "#fff",
                  color: "#111",
                }}
              >
                {urls[`e-${e.jedinica_id}`] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[`e-${e.jedinica_id}`]}
                    alt={e.kod}
                    style={{ width: 140, height: 140 }}
                  />
                ) : (
                  <div style={{ height: 140 }}>…</div>
                )}
                <div style={{ fontWeight: 800, fontSize: 13 }}>{e.kod}</div>
                <div style={{ fontSize: 11 }}>{e.sifra}</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>{e.stanje}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <style>{`
        @media print {
          .topBlock, .btn, .brandSlogan { display: none !important; }
          .ops-qr-grid { gap: 8px; }
        }
      `}</style>
    </div>
  );
}
