import { NextRequest, NextResponse } from "next/server";
import { processOrderConsumption } from "@/services/consumption.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

// POST /api/orders/[id]/consume
// Manually (re-)runs the consumption engine for one order — used to retry
// lines stuck in NO_RECIPE or INSUFFICIENT_STOCK after the operator fixes
// the underlying issue (maps a recipe, restocks a material). Already-
// CONSUMED lines are untouched (spec §28 idempotency).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "consumption.write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const storeId = getStoreId(session);
    const { id } = await params;

    const result = await processOrderConsumption(storeId, id);
    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "UNAUTHORIZED")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (err.message === "Order not found")
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
