import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { Prisma } from "@prisma/client";

export const RETURN_CONDITIONS = ["GOOD", "DAMAGED", "OPENED", "UNSELLABLE", "UNKNOWN"] as const;
type Condition = typeof RETURN_CONDITIONS[number];
const round = (n: number) => Math.round(n * 1e6) / 1e6;

export async function listReturns(storeId: string) {
  return db.return.findMany({ where: { storeId }, include: { order: true, items: { include: { orderItem: true } }, expense: true }, orderBy: { createdAt: "desc" } });
}

export async function listExpenses(storeId: string) {
  return db.expense.findMany({ where: { storeId }, include: { category: true, return: true }, orderBy: { date: "desc" } });
}

export async function createExpenseCategory(storeId: string, name: string, userId?: string) {
  return db.$transaction(async tx => {
    const category = await tx.expenseCategory.create({ data: { storeId, name } });
    await tx.auditLog.create({ data: { storeId, userId, action: "CREATE", entity: "ExpenseCategory", entityId: category.id, after: { name } } });
    return category;
  });
}

export async function createExpense(input: { storeId: string; categoryId: string; amount: number; date: Date; description?: string; reference?: string; userId?: string }) {
  const category = await db.expenseCategory.findFirst({ where: { id: input.categoryId, storeId: input.storeId, active: true } });
  if (!category) throw new Error("Category not found");
  const store = await db.store.findUniqueOrThrow({ where: { id: input.storeId } });
  return db.$transaction(async tx => {
    const expense = await tx.expense.create({ data: { ...input, currency: store.currency } });
    await tx.auditLog.create({ data: { storeId: input.storeId, userId: input.userId, action: "CREATE", entity: "Expense", entityId: expense.id, after: { amount: input.amount, categoryId: input.categoryId } } });
    return expense;
  });
}

export async function processReturn(input: { storeId: string; returnId: string; userId: string; returnCost?: number; items: { id: string; condition: Condition; restock: boolean }[] }) {
  const configuredCost = Number(await getSetting(input.storeId, "defaultReturnCost"));
  const cost = input.returnCost ?? configuredCost;
  if (!Number.isFinite(cost) || cost < 0) throw new Error("Invalid return cost");
  const store = await db.store.findUniqueOrThrow({ where: { id: input.storeId } });
  return db.$transaction(async tx => {
    const ret = await tx.return.findFirst({ where: { id: input.returnId, storeId: input.storeId }, include: { order: { include: { items: true } }, items: { include: { orderItem: { include: { consumption: { include: { items: true } } } } } } } });
    if (!ret) throw new Error("Return not found");
    if (ret.processedAt) throw new Error("Return already processed");
    if (ret.items.some(i => Number(i.quantity) <= 0 || Number(i.quantity) > Number(i.orderItem.quantity))) throw new Error("Invalid return quantity");
    if (input.items.length !== ret.items.length || new Set(input.items.map(i => i.id)).size !== ret.items.length) throw new Error("Classify every returned item once");
    const byId = new Map(input.items.map(i => [i.id, i]));
    for (const item of ret.items) {
      const decision = byId.get(item.id);
      if (!decision) throw new Error("Invalid return item");
      if (ret.order.manualStatus && (decision.condition !== "GOOD" || decision.restock !== Boolean(item.orderItem.consumption))) throw new Error("Manual return must restore consumed materials");
      if (decision.restock && decision.condition !== "GOOD") throw new Error("Only good items can be restocked");
      if (decision.restock) {
        const consumption = item.orderItem.consumption;
        if (!consumption) throw new Error("Cannot restock without recorded consumption");
        const earlier = await tx.returnItem.aggregate({ where: { orderItemId: item.orderItemId, restocked: true }, _sum: { quantity: true } });
        if (Number(earlier._sum.quantity ?? 0) + Number(item.quantity) > Number(consumption.quantity)) throw new Error("Restock exceeds consumed quantity");
        for (const component of consumption.items) {
          const qty = round(Number(component.quantity) * Number(item.quantity) / Number(consumption.quantity));
          if (qty <= 0) continue;
          await tx.inventoryTransaction.create({ data: { storeId: input.storeId, materialId: component.materialId, type: "RETURN_RESTOCK", quantity: qty, unit: component.unit, referenceType: "RETURN_ITEM", referenceId: item.id, userId: input.userId } });
          await tx.inventoryBalance.update({ where: { materialId: component.materialId }, data: { quantity: { increment: qty } } });
        }
      }
      await tx.returnItem.update({ where: { id: item.id }, data: { condition: decision.condition, restocked: decision.restock, restockedAt: decision.restock ? new Date() : null } });
    }
    const category = await tx.expenseCategory.upsert({ where: { storeId_name: { storeId: input.storeId, name: "Return Cost" } }, update: {}, create: { storeId: input.storeId, name: "Return Cost" } });
    const expense = await tx.expense.create({ data: { storeId: input.storeId, categoryId: category.id, returnId: ret.id, amount: cost, currency: store.currency, date: new Date(), description: `Return for order ${ret.orderId}`, userId: input.userId } });
    await tx.return.update({ where: { id: ret.id }, data: { status: "PROCESSED", processedAt: new Date(), returnCost: cost } });
    if (ret.order.manualStatus) {
      if (ret.items.length !== ret.order.items.length || ret.items.some(item => Number(item.quantity) !== Number(item.orderItem.quantity))) throw new Error("Manual return must include all items");
      const paidAmount = ret.order.financialStatus === "PAID" ? ret.order.total : ret.order.depositAmount;
      await tx.order.update({ where: { id: ret.orderId }, data: {
        manualStatus: "RETURNED", financialStatus: Number(ret.order.depositAmount) > 0 || ret.order.financialStatus === "PAID" ? "REFUNDED" : "VOIDED",
        fulfillmentStatus: "UNFULFILLED", refunded: paidAmount, netSales: 0,
      } });
      for (const item of ret.order.items) await tx.orderItem.update({ where: { id: item.id }, data: { refunded: item.finalLinePrice } });
    }
    await tx.auditLog.create({ data: { storeId: input.storeId, userId: input.userId, action: "PROCESS_RETURN", entity: "Return", entityId: ret.id, metadata: { expenseId: expense.id, restockedItems: input.items.filter(i => i.restock).map(i => i.id) } } });
    return { returnId: ret.id, expenseId: expense.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function recordMaterialPurchase(input: { storeId: string; materialId: string; quantity: number; amount: number; date: Date; userId: string; reference?: string }) {
  const material = await db.material.findFirst({ where: { id: input.materialId, storeId: input.storeId } });
  if (!material) throw new Error("Material not found");
  const store = await db.store.findUniqueOrThrow({ where: { id: input.storeId } });
  return db.$transaction(async tx => {
    const category = await tx.expenseCategory.upsert({ where: { storeId_name: { storeId: input.storeId, name: "Material Purchases" } }, update: {}, create: { storeId: input.storeId, name: "Material Purchases" } });
    const purchase = await tx.materialPurchase.create({ data: { storeId: input.storeId, supplierId: material.supplierId, reference: input.reference, totalAmount: input.amount, purchasedAt: input.date, items: { create: { materialId: material.id, quantity: input.quantity, unitCost: input.amount / input.quantity } } } });
    const transaction = await tx.inventoryTransaction.create({ data: { storeId: input.storeId, materialId: material.id, type: "PURCHASE", quantity: input.quantity, unit: material.unit, referenceType: "PURCHASE", referenceId: purchase.id, reason: "Material purchase", userId: input.userId } });
    await tx.inventoryBalance.update({ where: { materialId: material.id }, data: { quantity: { increment: input.quantity } } });
    const expense = await tx.expense.create({ data: { storeId: input.storeId, categoryId: category.id, purchaseId: purchase.id, amount: input.amount, currency: store.currency, date: input.date, description: `Purchase: ${material.name}`, reference: input.reference, userId: input.userId } });
    await tx.auditLog.create({ data: { storeId: input.storeId, userId: input.userId, action: "MATERIAL_PURCHASE", entity: "Expense", entityId: expense.id, metadata: { transactionId: transaction.id } } });
    return { purchase, transaction, expense };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
