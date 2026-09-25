import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

const builtins: Record<string, { name: string; aliases: string[]; unit: string }> = {
  OILS: { name: "زيوت", aliases: ["زيوت", "زيت"], unit: "مل" },
  BOTTLES: { name: "زجاجات", aliases: ["زجاجات", "زجاجة"], unit: "قطعة" },
  BOXES: { name: "بوكسات التغليف", aliases: ["بوكسات التغليف", "بوكسات", "بوكس"], unit: "قطعة" },
  TESTERS: { name: "زجاجات تيستر", aliases: ["زجاجات تيستر", "تيستر"], unit: "قطعة" },
};

const schema = z.object({
  requestId: z.string().uuid(),
  category: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().finite().positive().max(10000000),
  amount: z.number().finite().positive().max(1000000000),
  unit: z.enum(["مل", "قطعة"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!["materials.write", "inventory.write", "expenses.write"].every((permission) => can(session.role, permission))) {
      return NextResponse.json({ error: "غير مسموح بتسجيل مشتريات المخزون" }, { status: 403 });
    }
    const data = schema.parse(await req.json());
    const purchaseId = `stock_${data.requestId}`;
    const existingPurchase = await db.materialPurchase.findUnique({ where: { id: purchaseId }, select: { id: true, storeId: true } });
    if (existingPurchase) {
      if (existingPurchase.storeId !== session.storeId) return NextResponse.json({ error: "تعذر حفظ الشراء" }, { status: 409 });
      return NextResponse.json({ data: { purchaseId, existing: true } });
    }
    const builtin = builtins[data.category];
    if (!builtin && !data.category.startsWith("type:")) return NextResponse.json({ error: "اختر نوعًا صحيحًا" }, { status: 422 });
    const requestedUnit = builtin?.unit ?? data.unit ?? "قطعة";
    if (requestedUnit === "قطعة" && !Number.isInteger(data.quantity)) return NextResponse.json({ error: "كمية القطع لازم تكون عددًا صحيحًا" }, { status: 422 });
    const amount = new Prisma.Decimal(Math.round(data.amount * 100)).div(100);
    const unitCost = amount.div(data.quantity).toDecimalPlaces(4);
    const store = await db.store.findUniqueOrThrow({ where: { id: session.storeId }, select: { currency: true } });
    try {
      const result = await db.$transaction(async (tx) => {
        let materialType;
        if (builtin) {
          materialType = await tx.materialType.findFirst({ where: { storeId: session.storeId, name: { in: builtin.aliases }, active: true } });
          materialType ??= await tx.materialType.upsert({ where: { storeId_code: { storeId: session.storeId, code: data.category } }, update: { active: true }, create: { storeId: session.storeId, name: builtin.name, code: data.category } });
        } else {
          materialType = await tx.materialType.findFirst({ where: { id: data.category.slice(5), storeId: session.storeId, active: true } });
          if (!materialType) throw new Error("INVALID_CATEGORY");
        }
        const unit = requestedUnit;
        let material = await tx.material.findFirst({ where: { storeId: session.storeId, materialTypeId: materialType.id, name: { equals: data.name, mode: "insensitive" }, active: true } });
        if (material && material.unit !== unit) throw new Error("UNIT_MISMATCH");
        if (!material) {
          material = await tx.material.create({ data: { storeId: session.storeId, materialTypeId: materialType.id, name: data.name, unit, baseUnit: unit, defaultCost: unitCost } });
          await tx.inventoryBalance.create({ data: { storeId: session.storeId, materialId: material.id, quantity: 0 } });
        } else {
          await tx.material.update({ where: { id: material.id }, data: { defaultCost: unitCost } });
        }
        const category = await tx.expenseCategory.upsert({ where: { storeId_name: { storeId: session.storeId, name: "Material Purchases" } }, update: {}, create: { storeId: session.storeId, name: "Material Purchases" } });
        const purchase = await tx.materialPurchase.create({ data: { id: purchaseId, storeId: session.storeId, totalAmount: amount, purchasedAt: new Date(), items: { create: { materialId: material.id, quantity: data.quantity, unitCost } } } });
        await tx.inventoryBalance.update({ where: { materialId: material.id }, data: { quantity: { increment: data.quantity } } });
        await tx.inventoryTransaction.create({ data: { storeId: session.storeId, materialId: material.id, type: "PURCHASE", quantity: data.quantity, unit, referenceType: "PURCHASE", referenceId: purchase.id, reason: "Material purchase", userId: session.userId } });
        await tx.expense.create({ data: { storeId: session.storeId, categoryId: category.id, purchaseId: purchase.id, amount, currency: store.currency, date: purchase.purchasedAt, description: `Purchase: ${material.name}`, userId: session.userId } });
        await tx.auditLog.create({ data: { storeId: session.storeId, userId: session.userId, action: "MATERIAL_PURCHASE", entity: "Material", entityId: material.id, metadata: { purchaseId } } });
        return { materialId: material.id, purchaseId };
      });
      return NextResponse.json({ data: result }, { status: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await db.materialPurchase.findFirst({ where: { id: purchaseId, storeId: session.storeId } });
        if (duplicate) return NextResponse.json({ data: { purchaseId, existing: true } });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "راجع الكمية والسعر واسم الخامة" }, { status: 422 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "سجّل الدخول أولًا" }, { status: 401 });
    if (error instanceof Error && ["INVALID_CATEGORY", "UNIT_MISMATCH"].includes(error.message)) return NextResponse.json({ error: error.message === "UNIT_MISMATCH" ? "اسم الخامة مسجل بوحدة مختلفة" : "نوع الخامة غير موجود" }, { status: 422 });
    console.error("Stock purchase failed", error);
    return NextResponse.json({ error: "تعذر حفظ المخزون، حاول مرة أخرى" }, { status: 500 });
  }
}
