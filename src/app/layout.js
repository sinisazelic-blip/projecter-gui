import "./globals.css";

export const metadata = {
  title: "Studio TAF · Fluxa",
  description: "Fluxa — upravljanje projektima i finansijama (GUI).",
};

export default function RootLayout({ children }) {
  return (
    <html lang="bs" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
