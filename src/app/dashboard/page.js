// src/app/dashboard/page.js
import { cookies } from "next/headers";
import ModernDashboard from "./ModernDashboard";
import ClassicDashboard from "./ClassicDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage(props) {
  const searchParams = props?.searchParams ? await props.searchParams : {};
  const cookieStore = await cookies();
  const cookieView = cookieStore.get("fluxa_dash_view")?.value;

  // Prioritet ima URL query parametar ?view=..., a zatim sačuvani cookie izbor
  const requestedView = searchParams?.view || cookieView || "modern";

  if (requestedView === "classic") {
    return <ClassicDashboard />;
  }

  return <ModernDashboard />;
}
