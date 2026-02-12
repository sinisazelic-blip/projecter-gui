import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "StrategicCore | Fluxa",
  description: "Brzo obračunavanje budžeta u pregovorima",
};

export default function StrategicCoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
