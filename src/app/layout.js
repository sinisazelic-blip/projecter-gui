import "./globals.css";
import "@/lib/ui/common-styles.css";

export const metadata = {
  title: "Fluxa · P&FE",
  description: "Fluxa — upravljanje projektima i finansijama (GUI).",
  icons: {
    icon: "/fluxa/Icon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="bs" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
