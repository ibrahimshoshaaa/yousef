import { db } from "@/lib/db";
import { getClientForStore } from "@/services/shopify/connection.service";
import { upsertShopifyOrder } from "@/services/shopify/order-sync.service";

export const shopifyOrderStages = ["PREPARED", "SHIPPING", "DELIVERED"] as const;
export type ShopifyOrderStage = (typeof shopifyOrderStages)[number];

export class ShopifyWorkflowError extends Error {}

export async function updateShopifyOrderStage(params: {
  storeId: string; orderId: string; userId: string; stage: ShopifyOrderStage;
}) {
  const { storeId, orderId, userId, stage } = params;
  const order = await db.order.findFirst({ where: { id: orderId, storeId } });
  if (!order?.shopifyId || order.manualStatus) throw new ShopifyWorkflowError("طلب Shopify غير موجود");
  if (order.shopifyStage === "DELIVERED") throw new ShopifyWorkflowError("الطلب تم تسليمه بالفعل");

  if (stage === "PREPARED") {
    if (order.shopifyStage || order.fulfillmentStatus !== "UNFULFILLED") throw new ShopifyWorkflowError("لا يمكن تجهيز هذا الطلب في حالته الحالية");
    const changed = await db.order.updateMany({ where: { id: orderId, storeId, shopifyStage: null, fulfillmentStatus: "UNFULFILLED" }, data: { shopifyStage: "PREPARED" } });
    if (!changed.count) throw new ShopifyWorkflowError("تغيرت حالة الطلب، حدّث الصفحة وحاول مرة أخرى");
  } else {
    if (stage === "SHIPPING" && order.shopifyStage !== "PREPARED") throw new ShopifyWorkflowError("جهّز الطلب قبل شحنه");
    if (stage === "DELIVERED" && order.shopifyStage !== "SHIPPING") throw new ShopifyWorkflowError("اشحن الطلب قبل تسجيل التسليم");

    const connection = await db.shopifyConnection.findUnique({ where: { storeId } });
    const granted = new Set(connection?.scope?.split(",").map(s => s.trim()) ?? []);
    const needed = stage === "SHIPPING"
      ? ["read_merchant_managed_fulfillment_orders", "write_merchant_managed_fulfillment_orders"]
      : ["read_fulfillments", "write_fulfillments", "read_merchant_managed_fulfillment_orders"];
    if (connection?.status !== "CONNECTED" || needed.some(s => !granted.has(s))) {
      throw new ShopifyWorkflowError("أعد ربط المتجر من إعدادات Shopify للموافقة على صلاحيات الشحن والتسليم");
    }
    const client = await getClientForStore(storeId);
    const state = await client.fetchFulfillmentState(order.shopifyId);
    if (!state) throw new ShopifyWorkflowError("الطلب غير موجود في Shopify");
    if (state.fulfillmentOrders.pageInfo.hasNextPage || state.fulfillments.length >= 100) throw new ShopifyWorkflowError("الطلب يحتوي على شحنات كثيرة، راجعه في Shopify");

    if (stage === "SHIPPING") {
      if (state.displayFulfillmentStatus !== "FULFILLED") {
        const open = state.fulfillmentOrders.nodes.filter(fo => fo.status === "OPEN");
        if (!["UNFULFILLED", "PARTIALLY_FULFILLED"].includes(state.displayFulfillmentStatus) || !open.length ||
            state.fulfillmentOrders.nodes.some(fo => !["OPEN", "CLOSED"].includes(fo.status))) {
          throw new ShopifyWorkflowError("لا يمكن شحن الطلب كاملًا في حالته الحالية في Shopify");
        }
        for (const fo of open) await client.createFulfillment(fo.id);
      }
      const remote = await client.fetchOrderById(order.shopifyId);
      if (!remote || remote.displayFulfillmentStatus !== "FULFILLED") throw new ShopifyWorkflowError("لم يكتمل الشحن في Shopify؛ حدّث الطلب وحاول مرة أخرى");
      await upsertShopifyOrder(storeId, remote);
    } else {
      if (state.displayFulfillmentStatus !== "FULFILLED" || !state.fulfillments.length ||
          state.fulfillments.some(f => f.status !== "SUCCESS")) throw new ShopifyWorkflowError("لا توجد شحنة مكتملة لتسجيل تسليمها");
      for (const fulfillment of state.fulfillments) {
        if (fulfillment.displayStatus !== "DELIVERED" && !fulfillment.deliveredAt) await client.createDeliveryEvent(fulfillment.id);
      }
    }
    await db.order.update({ where: { id: orderId }, data: { shopifyStage: stage } });
  }

  await db.auditLog.create({ data: {
    storeId, userId, action: "SHOPIFY_ORDER_STAGE", entity: "Order", entityId: orderId,
    before: { stage: order.shopifyStage }, after: { stage },
  } });
  return db.order.findUniqueOrThrow({ where: { id: orderId } });
}
