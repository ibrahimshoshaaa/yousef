import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

const schema = z.object({
  requestId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(100),
  customerPhone: z.string().trim().min(7).max(30),
  customerAddress: z.string().trim().min(5).max(500),
  hasDeposit: z.boolean(),
  depositAmount: z.number().finite().nonnegative().max(1000000),
  items: z.array(z.object({
    variantId: z.string().min(1),
    quantity: z.number().int().positive().max(10000),
    unitPrice: z.number().finite().min(0).max(1000000),
  })).min(1).max(30),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "orders.write")) return NextResponse.json({ error: "غير مسموح بتسجيل المبيعات" }, { status: 403 });
    const input = schema.parse(await req.json());
    const orderId = `manual_${input.requestId}`;
    let order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, storeId: true } });
    if (order && order.storeId !== session.storeId) return NextResponse.json({ error: "تعذر تسجيل البيع" }, { status: 409 });

    if (!order) {
      const ids = input.items.map((item) => item.variantId);
      if (new Set(ids).size !== ids.length) return NextResponse.json({ error: "اختر كل حجم مرة واحدة فقط" }, { status: 422 });
      const [variants, store] = await Promise.all([
        db.productVariant.findMany({ where: { id: { in: ids }, storeId: session.storeId, active: true }, include: { product: { select: { title: true } } } }),
        db.store.findUniqueOrThrow({ where: { id: session.storeId }, select: { currency: true } }),
      ]);
      if (variants.length !== ids.length) return NextResponse.json({ error: "منتج أو حجم غير موجود في متجرك" }, { status: 422 });
      const byId = new Map(variants.map((variant) => [variant.id, variant]));
      const lines = input.items.map((item) => {
        const variant = byId.get(item.variantId)!;
        const priceCents = Math.round(item.unitPrice * 100);
        return {
          variantId: variant.id,
          title: `${variant.product.title} · ${variant.title}`,
          sku: variant.sku,
          quantity: item.quantity,
          originalPrice: new Prisma.Decimal(priceCents).div(100),
          discount: new Prisma.Decimal(0),
          finalLinePrice: new Prisma.Decimal(priceCents * item.quantity).div(100),
          refunded: new Prisma.Decimal(0),
        };
      });
      const totalCents = lines.reduce((sum, line) => sum + Math.round(Number(line.finalLinePrice) * 100), 0);
      if (totalCents < 1) return NextResponse.json({ error: "إجمالي البيع لازم يكون أكبر من صفر" }, { status: 422 });
      const depositCents = Math.round(input.depositAmount * 100);
      if ((input.hasDeposit && depositCents < 1) || (!input.hasDeposit && depositCents !== 0)) return NextResponse.json({ error: "راجع قيمة الديبوزت" }, { status: 422 });
      if (depositCents >= totalCents) return NextResponse.json({ error: "الديبوزت لازم يكون أقل من إجمالي الطلب" }, { status: 422 });
      const total = new Prisma.Decimal(totalCents).div(100);
      try {
        order = await db.$transaction(async (tx) => {
          const created = await tx.order.create({ data: {
            id: orderId,
            storeId: session.storeId,
            orderNumber: `M-${input.requestId.slice(0, 8).toUpperCase()}`,
            financialStatus: depositCents > 0 ? "PARTIALLY_PAID" : "PENDING",
            fulfillmentStatus: "UNFULFILLED",
            manualStatus: "NEW",
            currency: store.currency,
            subtotal: total, shipping: 0, tax: 0, discount: 0,
            total, refunded: 0, netSales: total,
            customerRef: input.customerName,
            customerPhone: input.customerPhone,
            customerAddress: input.customerAddress,
            depositAmount: new Prisma.Decimal(depositCents).div(100),
            occurredAt: new Date(),
            items: { create: lines },
          } });
          await tx.auditLog.create({ data: { storeId: session.storeId, userId: session.userId, action: "CREATE", entity: "Order", entityId: created.id, metadata: { source: "MANUAL" } } });
          return { id: created.id, storeId: created.storeId };
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
        order = await db.order.findFirst({ where: { id: orderId, storeId: session.storeId }, select: { id: true, storeId: true } });
        if (!order) throw error;
      }
    }

    return NextResponse.json({ data: { orderId: order.id } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "راجع بيانات البيع", issues: error.issues }, { status: 422 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "سجّل الدخول أولًا" }, { status: 401 });
    console.error("Manual sale failed", error);
    return NextResponse.json({ error: "تعذر حفظ البيع، حاول مرة أخرى" }, { status: 500 });
  }
}
