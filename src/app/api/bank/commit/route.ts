import { withApiErrorBoundary } from "@/lib/api/routeWrap";
import { handleBankCommit } from "@/lib/bank/routes/bankCommit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiErrorBoundary(handleBankCommit);
