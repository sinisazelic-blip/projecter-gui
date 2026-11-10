// src/app/api/projects/route.js
import { NextResponse } from "next/server";
import { withDbSession } from "@/lib/auth/with-db-session";
import { getProjectsList } from "@/lib/projects/get-projects";

export const dynamic = "force-dynamic";

function intOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function decOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req) {
  return withDbSession(req, async (req, session) => {
    try {
      const url = new URL(req.url);

      const params = {
        q: (url.searchParams.get("q") || "").trim(),
        narucilac_id: intOrNull(url.searchParams.get("narucilac_id")),
        krajnji_klijent_id: intOrNull(url.searchParams.get("krajnji_klijent_id")),
        id_po: intOrNull(url.searchParams.get("id_po")),
        min_budget: decOrNull(url.searchParams.get("min_budget")),
        max_budget: decOrNull(url.searchParams.get("max_budget")),
        only_over_budget: url.searchParams.get("only_over_budget") === "1",
        status_group: url.searchParams.get("status_group"),
        status_id: intOrNull(url.searchParams.get("status_id")),
        show_storno: url.searchParams.get("show_storno") === "1",
        limit: intOrNull(url.searchParams.get("limit")),
        page: intOrNull(url.searchParams.get("page")),
        sort: url.searchParams.get("sort"),
        dir: url.searchParams.get("dir"),
      };

      const result = await getProjectsList(params, session);
      return NextResponse.json(result);
    } catch (err) {
      const msg = err?.message || "Greška na serveru";
      return NextResponse.json(
        { ok: false, error: msg, message: msg },
        { status: 500 },
      );
    }
  });
}
