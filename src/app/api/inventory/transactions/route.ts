import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "inventory.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storeId = getStoreId(session);
    const { searchParams } = new URL(req.url);
    const materialId = searchParams.get("materialId");
    const type = searchParams.get("type");
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
    const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);

    const where = {
      storeId,
      ...(materialId ? { materialId } : {}),
      ...(type ? { type } : {}),
    };

    const [total, transactions] = await Promise.all([
      db.inventoryTransaction.count({ where }),
      db.inventoryTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          material: { select: { id: true, name: true, unit: true } },
        },
      }),
    ]);

    return NextResponse.json({
      data: transactions,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
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
