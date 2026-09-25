import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

const schema = z.object({
  requestId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  price: z.number().finite().positive().max(1000000),
  materials: z.array(z.object({ materialId: z.string().min(1), quantity: z.number().finite().positive().max(10000000) })).min(1).max(30),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "products.write") || !can(session.role, "recipes.write")) return NextResponse.json({ error: "غير مسموح بإضافة منتجات" }, { status: 403 });
    const input = schema.parse(await req.json());
    const productId = `simple_${input.requestId}`;
    const existing = await db.product.findUnique({ where: { id: productId }, select: { id: true, storeId: true } });
    if (existing) {
      if (existing.storeId !== session.storeId) return NextResponse.json({ error: "تعذر إضافة العطر" }, { status: 409 });
      return NextResponse.json({ data: { productId } });
    }
    const ids = input.materials.map((item) => item.materialId);
    if (new Set(ids).size !== ids.length) return NextResponse.json({ error: "اختر كل خامة مرة واحدة فقط" }, { status: 422 });
    const materials = await db.material.findMany({ where: { storeId: session.storeId, id: { in: ids }, active: true }, select: { id: true, unit: true } });
    if (materials.length !== ids.length) return NextResponse.json({ error: "خامة غير موجودة في المخزون" }, { status: 422 });
    const units = new Map(materials.map((material) => [material.id, material.unit]));
    let result;
    try {
      result = await db.$transaction(async (tx) => {
      const product = await tx.product.create({ data: { id: productId, storeId: session.storeId, title: input.name } });
      const variant = await tx.productVariant.create({ data: { storeId: session.storeId, productId: product.id, title: input.name, price: new Prisma.Decimal(Math.round(input.price * 100)).div(100) } });
      const recipe = await tx.recipe.create({ data: { storeId: session.storeId, variantId: variant.id, name: input.name } });
      await tx.recipeVersion.create({ data: { storeId: session.storeId, recipeId: recipe.id, version: 1, isCurrent: true, items: { create: input.materials.map((item) => ({ materialId: item.materialId, quantity: item.quantity, unit: units.get(item.materialId)! })) } } });
      await tx.auditLog.create({ data: { storeId: session.storeId, userId: session.userId, action: "CREATE", entity: "Product", entityId: product.id, metadata: { recipeId: recipe.id, variantId: variant.id } } });
      return { productId: product.id };
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      const duplicate = await db.product.findFirst({ where: { id: productId, storeId: session.storeId } });
      if (!duplicate) throw error;
      result = { productId };
    }
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "راجع بيانات المنتج والخامات" }, { status: 422 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "سجّل الدخول أولًا" }, { status: 401 });
    console.error("Simple product failed", error);
    return NextResponse.json({ error: "تعذر حفظ المنتج" }, { status: 500 });
  }
}
