import "./globals.css";
import "@/lib/ui/common-styles.css";
import { cookies, headers } from "next/headers";
import { AuthUserProvider } from "@/components/AuthUserProvider";
import { FluxaEditionProvider } from "@/components/FluxaEditionProvider";
import { GlobalTooltip } from "@/components/GlobalTooltip";
import LicenceCheckWrapper from "@/components/LicenceCheckWrapper";
import { LocaleProvider } from "@/components/LocaleProvider";
import OnboardingTourWrapper from "@/components/OnboardingTourWrapper";
import PerformanceMeasurePatch from "@/components/PerformanceMeasurePatch";
import SubscriptionGuard from "@/components/SubscriptionGuard";
import { ThemeProvider } from "@/components/ThemeProvider";
import UputstvoShortcut from "@/components/UputstvoShortcut";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { runWithSession } from "@/lib/db";
import { getValidLocale } from "@/lib/i18n";
import { FLUXA_BUILD_LABEL } from "@/lib/fluxaVersion";

function getFaviconPath(host) {
  if (!host || typeof host !== "string") return "/fluxa/Icon.ico";
  if (
    host === "localhost" ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("localhost:")
  )
    return "/fluxa/Icon-local.png";
  return "/fluxa/Icon.ico";
}

export async function generateMetadata() {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  return {
    title: "Fluxa · P&FE",
    description: "Fluxa — upravljanje projektima i finansijama (GUI).",
    icons: {
      icon: getFaviconPath(host),
    },
  };
}

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const headersList = await headers();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value ?? "sr");
  const lang = locale === "en" ? "en" : "bs";
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  return await runWithSession(session, () => (
    <html
      lang={lang}
      data-theme="dark"
      data-locale={locale}
      suppressHydrationWarning
    >
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
                  <div
                    style={{
                      position: "fixed",
                      left: 12,
                      bottom: 10,
                      fontSize: 12,
                      color: "var(--muted)",
                      opacity: 0.7,
                      zIndex: 999,
                      pointerEvents: "none",
                    }}
                  >
                    {FLUXA_BUILD_LABEL}
                  </div>
                </AuthUserProvider>
              </LicenceCheckWrapper>
            </FluxaEditionProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  ));
}
