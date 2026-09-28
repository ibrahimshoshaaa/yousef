import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireAuth } from "@/lib/auth-helpers";

const schema = z.object({ title: z.string().trim().min(1).max(200),
  variantTitle: z.string().trim().min(1).max(200), sku: z.string().trim().max(100).nullable().optional(),
  price: z.number().finite().min(0).max(1000000) });

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "products.write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const input = schema.parse(await request.json());
    const product = await db.$transaction(async tx => {
      const created = await tx.product.create({ data: { storeId: session.storeId, title: input.title,
        status: "ACTIVE", variants: { create: { storeId: session.storeId, title: input.variantTitle,
          sku: input.sku || null, price: input.price } } }, include: { variants: true } });
      await tx.auditLog.create({ data: { storeId: session.storeId, userId: session.userId,
        action: "CREATE", entity: "Product", entityId: created.id, metadata: { source: "mobile" } } });
      return created;
    });
    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "راجع اسم المنتج والحجم والسعر", issues: error.issues }, { status: 422 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Create mobile product failed", error);
    return NextResponse.json({ error: "تعذر إضافة المنتج" }, { status: 500 });
  }
}
