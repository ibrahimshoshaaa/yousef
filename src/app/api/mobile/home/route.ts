import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    if (!can(session.role, "dashboard.read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const [orders, materials, pendingReturns] = await Promise.all([
      db.order.count({ where: { storeId: session.storeId } }),
      db.material.count({ where: { storeId: session.storeId, active: true } }),
      can(session.role, "returns.read") ? db.return.count({ where: { storeId: session.storeId, processedAt: null } }) : Promise.resolve(null),
    ]);
    return NextResponse.json({ data: { orders, materials, pendingReturns } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw error;
  }
}
