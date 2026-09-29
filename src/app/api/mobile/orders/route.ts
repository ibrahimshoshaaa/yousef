import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "orders.read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const page = Math.max(1, Math.min(100000, Number(request.nextUrl.searchParams.get("page")) || 1));
    const search = (request.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 100);
    const where = { storeId: session.storeId, ...(search ? { OR: [{ orderNumber: { contains: search, mode: "insensitive" as const } }, { customerRef: { contains: search, mode: "insensitive" as const } }] } : {}) };
    const [orders, count] = await Promise.all([
      db.order.findMany({ where, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], skip: (page - 1) * 25, take: 25, select: {
        id: true, orderNumber: true, occurredAt: true, financialStatus: true, fulfillmentStatus: true, manualStatus: true, shopifyStage: true, shopifyId: true,
        currency: true, total: true, netSales: true, depositAmount: true, customerRef: true, customerPhone: true, customerAddress: true,
        items: { select: { id: true, title: true, quantity: true, finalLinePrice: true, consumptionStatus: true } },
      } }),
      db.order.count({ where }),
    ]);
    return NextResponse.json({ data: orders, page, count, hasMore: page * 25 < count }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw error;
  }
}
