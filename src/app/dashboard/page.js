// src/app/dashboard/page.js
import ModernDashboard from "./ModernDashboard";
import ClassicDashboard from "./ClassicDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage(props) {
  const searchParams = props?.searchParams ? await props.searchParams : {};

  // Podrazumijevano (default) je novi moderni launcher za sve ulaze u sistem.
  // Klasični pult se prikazuje isključivo ako je eksplicitno zatražen preko ?view=classic
  const requestedView = searchParams?.view || "modern";

  if (requestedView === "classic") {
    return <ClassicDashboard />;
  }

  return <ModernDashboard />;
}
