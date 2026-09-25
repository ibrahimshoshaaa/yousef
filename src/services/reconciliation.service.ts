import { db } from "@/lib/db";
import { reconcileBalances } from "./reconciliation.math";

export async function getInventoryReconciliation(storeId: string) {
  const [balances, transactions] = await Promise.all([
    db.inventoryBalance.findMany({ where: { storeId }, select: { materialId: true, quantity: true, material: { select: { name: true, unit: true } } } }),
    db.inventoryTransaction.findMany({ where: { storeId }, select: { materialId: true, type: true, quantity: true } }),
  ]);
  return reconcileBalances(balances, transactions);
}
