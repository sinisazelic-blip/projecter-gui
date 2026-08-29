import { redirect } from "next/navigation";
import { requireEnterPage } from "@/lib/ops/access";

export const dynamic = "force-dynamic";

export default function OpsIndexPage() {
  requireEnterPage();
  redirect("/ops/artikli");
}
