import { NextResponse } from "next/server";
import {
  compareSemver,
  driveConfig,
  isProductName,
  listProducts,
  pickLatestZip,
  semverOf,
  type UpdateFile,
} from "@/lib/drive-updates";
import {
  bearerToken,
  licenceDecision,
  loadPublicTenant,
} from "@/lib/public-licence";
import { productsForLicence } from "@/lib/update-products";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function describe(
  product: string,
  listed: { folderFound: boolean; files: UpdateFile[] } | undefined,
  current: string,
) {
  const files = listed?.files ?? [];
  const latestFile = pickLatestZip(files);
  const latest = latestFile
    ? (semverOf(latestFile.name)?.join(".") ?? null)
    : null;
  const currentVer = current ? semverOf(current) : null;
  const latestVer = latestFile ? semverOf(latestFile.name) : null;
  const updateAvailable = Boolean(
    latestVer && (!currentVer || compareSemver(latestVer, currentVer) > 0),
  );
  return {
    product,
    folderFound: listed?.folderFound ?? false,
    current: current || null,
    latest,
    updateAvailable,
    file: latestFile?.name ?? null,
    size: latestFile?.size ?? null,
  };
}

/**
 * Paketi koje ovaj token smije da vidi, po profilu iz tenant centra.
 * Bez product: svi dozvoljeni folderi. Sa product: samo taj, ako je u licenci.
 *
 * GET /api/public/update-check
 * GET /api/public/update-check?product=dokumentart&current=2.0.44
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
  const current = String(url.searchParams.get("current") ?? "").trim();
  if (product && !isProductName(product)) {
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
    if (product && !allowed.includes(product as (typeof allowed)[number])) {
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

    const names = product ? [product] : allowed;
    const listed = await listProducts(names);
    const products = names.map((name) =>
      describe(name, listed.get(name), product ? current : ""),
    );

    return NextResponse.json({
      ok: true,
      allowed: true,
      profile: tenant.studio_licence_profile,
      products,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UPDATE_CHECK_FAILED";
    console.error("[update-check]", msg);
    const known = msg.startsWith("UPDATE_");
    return NextResponse.json(
      { ok: false, error: known ? msg : "UPDATE_CHECK_FAILED" },
      { status: 503 },
    );
  }
}
