import { NextResponse } from "next/server";
import {
  driveConfig,
  isProductName,
  isUpdateFileName,
  openProductFile,
} from "@/lib/drive-updates";
import {
  bearerToken,
  licenceDecision,
  loadPublicTenant,
} from "@/lib/public-licence";
import { productsForLicence } from "@/lib/update-products";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Preuzimanje jednog fajla iz FluxaUpdate/{product}.
 * Bearer = tenants.licence_token. Zatvorena licenca ne dobija bajtove.
 *
 * GET /api/public/update-file?product=dokumentart&name=2.0.45.zip
 */
export async function GET(req: Request) {
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json(
      { ok: false, allowed: false, reason: "invalid_token" },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const product = String(url.searchParams.get("product") ?? "")
    .trim()
    .toLowerCase();
  const name = String(url.searchParams.get("name") ?? "").trim();
  if (!isProductName(product) || !isUpdateFileName(name)) {
    return NextResponse.json(
      { ok: false, error: "UPDATE_PRODUCT_INVALID" },
      { status: 400 },
    );
  }

  try {
    const tenant = await loadPublicTenant(token);
    if (!tenant) {
      return NextResponse.json(
        { ok: false, allowed: false, reason: "invalid_token" },
        { status: 401 },
      );
    }
    const decision = licenceDecision(tenant);
    if (!decision.allowed) {
      return NextResponse.json(
        { ok: false, allowed: false, reason: decision.reason },
        { status: 403 },
      );
    }
    const allowed = productsForLicence(tenant);
    if (!allowed.includes(product as (typeof allowed)[number])) {
      return NextResponse.json(
        { ok: false, allowed: false, reason: "product_not_licensed" },
        { status: 403 },
      );
    }

    if (!driveConfig()) {
      return NextResponse.json(
        { ok: false, error: "UPDATE_DRIVE_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    const opened = await openProductFile(product, name);
    if (!opened) {
      return NextResponse.json(
        { ok: false, error: "UPDATE_FILE_NOT_FOUND" },
        { status: 404 },
      );
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      opened.file.mimeType || "application/octet-stream",
    );
    headers.set(
      "Content-Disposition",
      `attachment; filename="${opened.file.name}"`,
    );
    headers.set("Cache-Control", "no-store");
    if (opened.file.size > 0)
      headers.set("Content-Length", String(opened.file.size));

    return new NextResponse(opened.body, { status: 200, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UPDATE_FILE_FAILED";
    console.error("[update-file]", msg);
    const known = msg.startsWith("UPDATE_");
    return NextResponse.json(
      { ok: false, error: known ? msg : "UPDATE_FILE_FAILED" },
      { status: 503 },
    );
  }
}
