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
import DemoBadge from "@/components/DemoBadge";
import { cookies, headers } from "next/headers";
import { getValidLocale } from "@/lib/i18n";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import { runWithSession } from "@/lib/db";

function isDemoInstanceHost(host) {
  if (!host || typeof host !== "string") return false;
  return host.includes("demo.studiotaf.xyz") || host.startsWith("demo.");
}

function getFaviconPath(host) {
  if (!host || typeof host !== "string") return "/fluxa/Icon.ico";
  if (host.includes("demo.studiotaf.xyz") || host.startsWith("demo.")) return "/fluxa/Icon-demo.png";
  if (host === "localhost" || host.startsWith("127.0.0.1") || host.startsWith("localhost:")) return "/fluxa/Icon-local.png";
  return "/fluxa/Icon.ico";
}

export async function generateMetadata() {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const isDemo = host.includes("demo.studiotaf.xyz") || host.startsWith("demo.");
  return {
    title: isDemo ? "Fluxa - DEMO" : "Fluxa · P&FE",
    description: "Fluxa — upravljanje projektima i finansijama (GUI).",
    icons: {
      icon: getFaviconPath(host),
    },
  };
}

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const forceEnForDemo = isDemoInstanceHost(host);
  const locale = forceEnForDemo ? "en" : getValidLocale(cookieStore.get("NEXT_LOCALE")?.value ?? "sr");
  const lang = locale === "en" ? "en" : "bs";
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  return await runWithSession(session, () => (
    <html lang={lang} data-theme="dark" data-locale={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('fluxa_theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');})();`,
          }}
        />
      </head>
      <body>
        <DemoBadge show={forceEnForDemo} />
        <PerformanceMeasurePatch />
        <ThemeProvider>
        <LocaleProvider initialLocale={locale} forceLocale={forceEnForDemo ? "en" : undefined}>
        <FluxaEditionProvider initialDemoInstance={forceEnForDemo}>
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
  ));
}
