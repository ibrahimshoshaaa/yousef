import { db } from "@/lib/db";
import type { ShopifyOrderNode } from "@/lib/shopify/types";
import { getClientForStore } from "@/services/shopify/connection.service";
import { syncRefundsForOrder } from "@/services/shopify/return-sync.service";
import { processOrderConsumption } from "@/services/consumption.service";

/**
 * Upserts one Shopify order + its line items into the local read snapshot
 * (spec §29). We deliberately do NOT try to replace Shopify as the
 * financial source of truth (spec §9/§30) — every money field here is
 * copied straight from Shopify's own totals, not recomputed.
 *
 * netSales is documented as an assumption (spec §5.14 requires documenting
 * rather than inventing rules): totalPrice - totalRefunded. Shopify's
 * totalPriceSet already nets out order-level discounts, so this is the
 * simplest number that matches "what the store actually kept" without us
 * re-deriving Shopify's discount math.
 *
 * After the snapshot is committed, this hands off to Chunk 5's consumption
 * engine (`processOrderConsumption`), which independently re-checks the
 * store's `orderConsumptionTrigger` setting against the order's *current*
 * financial/fulfillment status before doing anything — so an order synced
 * here before it's paid does not consume inventory, and re-syncing it later
 * (e.g. the ORDERS_PAID webhook, or a manual resync) is what actually
 * triggers consumption once the condition is met. Consumption failures are
 * caught and logged rather than rethrown: a per-line issue (missing recipe,
 * insufficient stock) is recorded on that OrderItem for the operator to see
 * and retry (spec §23), and must never fail the order sync itself.
 */
export async function upsertShopifyOrder(storeId: string, node: ShopifyOrderNode) {
  const subtotal = num(node.subtotalPriceSet);
  const shipping = num(node.totalShippingPriceSet);
  const tax = num(node.totalTaxSet);
  const discount = num(node.totalDiscountsSet);
  const total = num(node.totalPriceSet);
  const refunded = num(node.totalRefundedSet);
  const netSales = total - refunded;

  const order = await db.$transaction(async (tx) => {
    const upserted = await tx.order.upsert({
      where: { storeId_shopifyId: { storeId, shopifyId: node.id } },
      update: {
        orderNumber: node.name,
        financialStatus: node.displayFinancialStatus,
        fulfillmentStatus: node.displayFulfillmentStatus,
        currency: node.currencyCode,
        subtotal,
        shipping,
        tax,
        discount,
        total,
        refunded,
        netSales,
        customerRef: node.customer?.id ?? null,
        occurredAt: new Date(node.processedAt ?? node.createdAt),
      },
      create: {
        storeId,
        shopifyId: node.id,
        orderNumber: node.name,
        financialStatus: node.displayFinancialStatus,
        fulfillmentStatus: node.displayFulfillmentStatus,
        currency: node.currencyCode,
        subtotal,
        shipping,
        tax,
        discount,
        total,
        refunded,
        netSales,
        customerRef: node.customer?.id ?? null,
        occurredAt: new Date(node.processedAt ?? node.createdAt),
      },
    });

    for (const edge of node.lineItems.edges) {
      const li = edge.node;
      const originalPrice = num(li.originalUnitPriceSet);
      const itemDiscount = num(li.totalDiscountSet);
      const finalLinePrice = originalPrice * li.quantity - itemDiscount;

      const variant = li.variant
        ? await tx.productVariant.findUnique({
            where: { storeId_shopifyId: { storeId, shopifyId: li.variant.id } },
          })
        : null;

      await tx.orderItem.upsert({
        where: { orderId_shopifyLineId: { orderId: upserted.id, shopifyLineId: li.id } },
        update: {
          variantId: variant?.id ?? null,
          title: li.title,
          sku: li.sku,
          quantity: li.quantity,
          originalPrice,
          discount: itemDiscount,
          finalLinePrice,
        },
        create: {
          orderId: upserted.id,
          shopifyLineId: li.id,
          variantId: variant?.id ?? null,
          title: li.title,
          sku: li.sku,
          quantity: li.quantity,
          originalPrice,
          discount: itemDiscount,
          finalLinePrice,
        },
      });
    }

    return upserted;
  });

  if (node.refunds.length) {
    await syncRefundsForOrder(storeId, order.id, node.refunds);
  }

  try {
    await processOrderConsumption(storeId, order.id);
  } catch (err) {
    // Never let a consumption-engine failure fail the order sync itself —
    // per-line problems are already recorded on the OrderItem for the
    // operator to see (spec §23); this catch is only for something
    // unexpected outside that per-item error handling.
    console.error(`processOrderConsumption failed for order ${order.id}:`, err);
  }

  return order;
}

export async function syncAllOrders(storeId: string): Promise<{ count: number }> {
  const client = await getClientForStore(storeId);
  let after: string | null = null;
  let count = 0;

  do {
    const page = await client.fetchOrdersPage(50, after);
    for (const node of page.nodes) {
      await upsertShopifyOrder(storeId, node);
      count++;
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);

  return { count };
}

function num(money: { shopMoney: { amount: string } }): number {
  return Number(money.shopMoney.amount);
}
