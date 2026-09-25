import { NextRequest, NextResponse } from "next/server";
import { listConsumption } from "@/services/consumption.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

// GET /api/consumption?orderId=&materialId=&variantId=&limit=
// Consumption history, filterable per spec §47 (date/product/variant/
// material/order/recipe version — date filtering is via the caller
// filtering the returned `order.occurredAt`/`createdAt` client-side for
// now; server-side date-range filtering lands with Chunk 7's reports).
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "consumption.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storeId = getStoreId(session);
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId") ?? undefined;
    const materialId = searchParams.get("materialId") ?? undefined;
    const variantId = searchParams.get("variantId") ?? undefined;
    const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

    const consumption = await listConsumption(storeId, {
      orderId,
      materialId,
      variantId,
      limit,
    });

    return NextResponse.json({ data: consumption });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
