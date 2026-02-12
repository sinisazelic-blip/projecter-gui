import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  title: "Fluxa Mobile | StrategicCore",
  description: "Brzi budžet u pregovorima — pojednostavljena mobilna verzija",
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        minHeight: "100dvh",
        background: "var(--bg, #0a0a0a)",
        color: "var(--text, #fafafa)",
      }}
    >
      {children}
    </div>
  );
}
