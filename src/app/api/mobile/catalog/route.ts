import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    if (!can(session.role, "orders.write") && !can(session.role, "recipes.read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const variants = await db.productVariant.findMany({
      where: { storeId: session.storeId, active: true, product: { NOT: { status: "ARCHIVED" } } },
      select: { id: true, title: true, price: true, product: { select: { title: true } } },
      orderBy: { product: { title: "asc" } },
    });
    return NextResponse.json({ data: variants.map(v => ({ id: v.id, title: `${v.product.title} · ${v.title}`, price: Number(v.price) })) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw error;
  }
}
