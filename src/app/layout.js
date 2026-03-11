import "./globals.css";
import "@/lib/ui/common-styles.css";
import { LocaleProvider } from "@/components/LocaleProvider";
import { FluxaEditionProvider } from "@/components/FluxaEditionProvider";
import { AuthUserProvider } from "@/components/AuthUserProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import SubscriptionGuard from "@/components/SubscriptionGuard";
import LicenceCheckWrapper from "@/components/LicenceCheckWrapper";
import PerformanceMeasurePatch from "@/components/PerformanceMeasurePatch";
import { GlobalTooltip } from "@/components/GlobalTooltip";
import UputstvoShortcut from "@/components/UputstvoShortcut";
import OnboardingTourWrapper from "@/components/OnboardingTourWrapper";
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
    <html lang={lang} data-theme="dark" data-locale={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('fluxa_theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');})();`,
          }}
        />
      </head>
      <body>
        <PerformanceMeasurePatch />
        <ThemeProvider>
        <LocaleProvider initialLocale={locale}>
        <FluxaEditionProvider>
          <LicenceCheckWrapper>
          <AuthUserProvider>
            <GlobalTooltip />
            <UputstvoShortcut />
            <OnboardingTourWrapper />
            <SubscriptionGuard>{children}</SubscriptionGuard>
          </AuthUserProvider>
        </LicenceCheckWrapper>
        </FluxaEditionProvider>
      </LocaleProvider>
      </ThemeProvider>
      </body>
    </html>
  );
}
