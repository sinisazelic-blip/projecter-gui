import "./globals.css";
import "@/lib/ui/common-styles.css";
import { LocaleProvider } from "@/components/LocaleProvider";
import { FluxaEditionProvider } from "@/components/FluxaEditionProvider";
import { cookies } from "next/headers";
import { getValidLocale } from "@/lib/i18n";

export const metadata = {
  title: "Fluxa · P&FE",
  description: "Fluxa — upravljanje projektima i finansijama (GUI).",
  icons: {
    icon: "/fluxa/Icon.ico",
  },
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value ?? "sr");
  const lang = locale === "en" ? "en" : "bs";
  return (
    <html lang={lang} data-theme="dark" data-locale={locale}>
      <body>
        <LocaleProvider initialLocale={locale}>
        <FluxaEditionProvider>{children}</FluxaEditionProvider>
      </LocaleProvider>
      </body>
    </html>
  );
}
