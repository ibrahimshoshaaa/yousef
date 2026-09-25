import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { SubscribedWebhookTopic } from "@/lib/shopify/topics";
import { getClientForStore } from "@/services/shopify/connection.service";
import { upsertShopifyProduct } from "@/services/shopify/product-sync.service";
import { upsertShopifyOrder } from "@/services/shopify/order-sync.service";
import { disconnectStore } from "@/services/shopify/connection.service";

/**
 * Webhook payloads (format: JSON, per the subscription created in
 * connection.service.ts) use Shopify's REST-style resource shape, not the
 * GraphQL shape our sync services expect. Rather than maintaining a second,
 * parallel field-mapping for that shape, we treat the webhook as a
 * "something changed" signal: pull the resource's GraphQL id out of the
 * payload and refetch the canonical GraphQL representation, then reuse the
 * exact same upsert function the initial sync uses. One mapping to
 * maintain, and the webhook-driven record can never drift from what a
 * manual resync would produce.
 */

type RawWebhookPayload = Record<string, unknown>;

function toGid(resource: "Order" | "Product", numericId: unknown): string {
  return `gid://shopify/${resource}/${numericId}`;
}

export class WebhookAlreadyProcessedError extends Error {
  constructor() {
    super("Webhook event already processed");
    this.name = "WebhookAlreadyProcessedError";
  }
}

/**
 * Persists the event first (idempotency gate via the (storeId, eventId)
 * unique constraint — spec §28), then processes it. If the same delivery
 * arrives twice, the second insert violates the unique constraint and we
 * short-circuit before any business logic runs.
 */
export async function receiveWebhookEvent(params: {
  storeId: string;
  eventId: string;
  topic: SubscribedWebhookTopic;
  payload: RawWebhookPayload;
}) {
  let event;
  try {
    event = await db.webhookEvent.create({
      data: {
        storeId: params.storeId,
        eventId: params.eventId,
        topic: params.topic,
        payload: params.payload as Prisma.InputJsonValue,
        status: "RECEIVED",
      },
    });
  } catch (err) {
    // Unique constraint violation on (storeId, eventId) => duplicate delivery.
    if (isUniqueConstraintError(err)) {
      throw new WebhookAlreadyProcessedError();
    }
    throw err;
  }

  await processWebhookEvent(event.id, params.storeId, params.topic, params.payload);
}

export async function processWebhookEvent(
  webhookEventId: string,
  storeId: string,
  topic: SubscribedWebhookTopic,
  payload: RawWebhookPayload
) {
  try {
    await dispatch(storeId, topic, payload);
    await db.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "FAILED", errorMessage: message.slice(0, 2000) },
    });
    throw err;
  }
}

async function dispatch(storeId: string, topic: SubscribedWebhookTopic, payload: RawWebhookPayload) {
  switch (topic) {
    case "ORDERS_CREATE":
    case "ORDERS_UPDATED":
    case "ORDERS_CANCELLED":
    case "ORDERS_PAID": {
      const gid = (payload.admin_graphql_api_id as string) ?? toGid("Order", payload.id);
      const client = await getClientForStore(storeId);
      const order = await client.fetchOrderById(gid);
      if (order) await upsertShopifyOrder(storeId, order);
      return;
    }

    case "REFUNDS_CREATE": {
      // Refund payloads carry order_id (numeric) — refetch the parent
      // order, whose GraphQL shape already nests its refunds, and let the
      // existing order upsert sync them (see order-sync.service.ts).
      const orderGid = toGid("Order", payload.order_id);
      const client = await getClientForStore(storeId);
      const order = await client.fetchOrderById(orderGid);
      if (order) await upsertShopifyOrder(storeId, order);
      return;
    }

    case "PRODUCTS_CREATE":
    case "PRODUCTS_UPDATE": {
      const gid = (payload.admin_graphql_api_id as string) ?? toGid("Product", payload.id);
      const client = await getClientForStore(storeId);
      const product = await client.fetchProductById(gid);
      if (product) await upsertShopifyProduct(storeId, product);
      return;
    }

    case "APP_UNINSTALLED": {
      await disconnectStore(storeId);
      return;
    }

    default: {
      const _exhaustive: never = topic;
      throw new Error(`Unhandled webhook topic: ${_exhaustive}`);
    }
  }
}

export async function retryFailedEvent(storeId: string, webhookEventId: string) {
  const event = await db.webhookEvent.findFirst({
    where: { id: webhookEventId, storeId, status: "FAILED" },
  });
  if (!event) throw new Error("Failed webhook event not found");

  const topic = event.topic as SubscribedWebhookTopic;
  await processWebhookEvent(event.id, storeId, topic, event.payload as unknown as RawWebhookPayload);
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
