import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { processOrderConsumption } from "@/services/consumption.service";
import { processReturn } from "@/services/finance.service";

export const manualOrderStatuses = ["NEW", "PREPARED", "SHIPPING", "DELIVERED", "RETURNED"] as const;
export type ManualOrderStatus = typeof manualOrderStatuses[number];

export async function updateManualOrderStatus(input: { storeId: string; orderId: string; userId: string; status: ManualOrderStatus }) {
  const order = await db.order.findFirst({ where: { id: input.orderId, storeId: input.storeId, manualStatus: { not: null } }, include: { items: { include: { consumption: true } } } });
  if (!order) throw new Error("الطلب غير موجود أو ليس طلبًا يدويًا");
  if (order.manualStatus === input.status) return { status: input.status };

  if (input.status === "RETURNED") {
    if (order.manualStatus !== "SHIPPING" && order.manualStatus !== "DELIVERED") throw new Error("يمكن إرجاع الطلب بعد بدء الشحن فقط");
    // A deterministic ID makes retries safe if processing fails after creating the return.
    const returnId = `manual_return_${order.id}`;
    let existing = await db.return.findUnique({ where: { id: returnId } });
    if (!existing) {
      try {
        existing = await db.return.create({ data: {
          id: returnId, storeId: input.storeId, orderId: order.id, status: "PENDING",
          totalAmount: order.total, returnCost: 95,
          items: { create: order.items.map(item => ({ orderItemId: item.id, quantity: item.quantity, condition: "UNKNOWN" })) },
        } });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
        existing = await db.return.findUnique({ where: { id: returnId } });
      }
    }
    if (!existing || existing.storeId !== input.storeId) throw new Error("تعذر إنشاء المرتجع");
    if (!existing.processedAt) {
      const returnItems = await db.returnItem.findMany({ where: { returnId }, include: { orderItem: { include: { consumption: true } } } });
      await processReturn({ storeId: input.storeId, returnId, userId: input.userId, returnCost: 95,
        items: returnItems.map(item => ({ id: item.id, condition: "GOOD" as const, restock: Boolean(item.orderItem.consumption) })),
      });
    }
    return { status: "RETURNED" as const };
  }

  const expected: Record<Exclude<ManualOrderStatus, "RETURNED" | "NEW">, ManualOrderStatus> = {
    PREPARED: "NEW", SHIPPING: "PREPARED", DELIVERED: "SHIPPING",
  };
  if (input.status === "NEW" || order.manualStatus !== expected[input.status]) throw new Error("انتقال حالة الطلب غير صحيح");
  if (input.status === "PREPARED") {
    const result = await processOrderConsumption(input.storeId, order.id, { forceForManualPreparation: true });
    if (result.failed || result.skipped) throw new Error("تعذر خصم كل خامات الوصفة. راجع صفحة الاستهلاك والمخزون ثم حاول ثانية");
    const incomplete = await db.orderItem.count({ where: { orderId: order.id, consumptionStatus: { not: "CONSUMED" } } });
    if (incomplete) throw new Error("تعذر خصم كل خامات الوصفة. راجع صفحة الاستهلاك والمخزون ثم حاول ثانية");
  }
  if (input.status === "SHIPPING") {
    if (order.items.some(item => !item.consumption)) throw new Error("لا يمكن شحن الطلب قبل خصم كل خامات الوصفات");
  }
  const changed = await db.$transaction(async tx => {
    const updated = await tx.order.updateMany({ where: { id: order.id, storeId: input.storeId, manualStatus: expected[input.status as keyof typeof expected] }, data: {
      manualStatus: input.status,
      ...(input.status === "DELIVERED" ? { financialStatus: "PAID", fulfillmentStatus: "FULFILLED" } : {}),
    } });
    if (!updated.count) return false;
    await tx.auditLog.create({ data: { storeId: input.storeId, userId: input.userId, action: "UPDATE", entity: "Order", entityId: order.id, metadata: { manualStatus: input.status } } });
    return true;
  });
  if (!changed) throw new Error("تغيرت حالة الطلب؛ حدّث الصفحة وحاول ثانية");
  return { status: input.status };
}
