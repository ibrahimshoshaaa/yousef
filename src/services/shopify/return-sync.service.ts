import { db } from "@/lib/db";
import type { ShopifyRefundNode } from "@/lib/shopify/types";

/**
 * Mirrors Shopify refunds into Return/ReturnItem (spec §31). This is a
 * *sync* step only — it records that Shopify refunded something, against
 * which line item, for how much. It does NOT decide whether to restock
 * components or create a return-cost expense: spec §32 is explicit that a
 * refund does not automatically mean restocking, and the restock/condition
 * triage + expense creation is Chunk 6's job.
 *
 * Assumption (documented per spec §5.14 rather than invented silently):
 * every synced refund starts with condition UNKNOWN, restocked=false, and
 * returnCost=0 until a person (or Chunk 6's workflow) classifies it.
 * ReturnItem.condition/restocked are intentionally left for that step to
 * set — sync must not guess whether a physical item was resellable.
 */
export async function syncRefundsForOrder(
  storeId: string,
  orderId: string,
  refunds: ShopifyRefundNode[]
) {
  for (const refund of refunds) {
    const totalAmount = Number(refund.totalRefundedSet.shopMoney.amount);

    const returnRow = await db.return.upsert({
      where: { storeId_shopifyId: { storeId, shopifyId: refund.id } },
      update: {},
      create: {
        storeId,
        orderId,
        shopifyId: refund.id,
        status: "SYNCED",
        totalAmount,
        returnCost: 0,
        createdAt: new Date(refund.createdAt),
      },
    });

    if (returnRow.processedAt) continue; // A later Shopify sync must never rewrite processed decisions.

    for (const edge of refund.refundLineItems.edges) {
      const rli = edge.node;
      if (!rli.lineItem) continue;

      const orderItem = await db.orderItem.findUnique({
        where: { orderId_shopifyLineId: { orderId, shopifyLineId: rli.lineItem.id } },
      });
      if (!orderItem) continue; // line item not synced yet — will reconcile on next sync

      await db.returnItem.upsert({
        where: { returnId_orderItemId: { returnId: returnRow.id, orderItemId: orderItem.id } },
        update: {},
        create: {
          returnId: returnRow.id,
          orderItemId: orderItem.id,
          quantity: rli.quantity,
          condition: "UNKNOWN",
          restocked: false,
        },
      });
    }
  }
}
