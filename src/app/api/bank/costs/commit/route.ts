import { withApiErrorBoundary } from "@/lib/api/routeWrap";
import { handleBankCostsCommit } from "@/lib/bank/routes/costs/commit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiErrorBoundary(handleBankCostsCommit);
