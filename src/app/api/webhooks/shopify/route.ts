import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getShopifyConfig } from "@/lib/config";
import { verifyShopifyWebhookHmac } from "@/lib/shopify/webhookVerify";
import { normalizeWebhookTopicHeader } from "@/lib/shopify/topics";
import { receiveWebhookEvent, WebhookAlreadyProcessedError } from "@/services/shopify/webhook.service";

/**
 * Flow follows spec §53 exactly:
 *   Receive request → Verify Shopify signature → Identify store →
 *   Check idempotency → Persist event → Process business operation →
 *   Mark processed
 *
 * HMAC verification MUST run against the raw request bytes, so this reads
 * the body as text before anything else touches it — parsing to JSON first
 * would verify a re-serialized (and therefore differently-signed) payload.
 *
 * No queue backs this route (spec forbids Redis/BullMQ), so processing
 * runs inline. We always return 200 once the event is durably persisted —
 * including when business processing subsequently fails — so Shopify
 * doesn't hammer retries into the same idempotency key. A failed event is
 * visible on the Shopify dashboard with a manual retry action instead.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let config;
  try {
    config = getShopifyConfig();
  } catch {
    return NextResponse.json({ error: "Shopify app not configured" }, { status: 501 });
  }

  const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
  if (!verifyShopifyWebhookHmac(rawBody, hmacHeader, config.webhookSecret)) {
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  const shopDomain = req.headers.get("x-shopify-shop-domain");
  const topicHeader = req.headers.get("x-shopify-topic");
  const eventId = req.headers.get("x-shopify-webhook-id");

  if (!shopDomain || !topicHeader || !eventId) {
    return NextResponse.json({ error: "Missing required Shopify headers" }, { status: 400 });
  }

  const topic = normalizeWebhookTopicHeader(topicHeader);
  if (!topic) {
    // We received a topic we never subscribed to — acknowledge and ignore
    // rather than erroring, so an unexpected Shopify-side change doesn't
    // create a retry storm.
    return NextResponse.json({ data: { ignored: true, topic: topicHeader } });
  }

  const store = await db.store.findUnique({ where: { shopifyShopDomain: shopDomain } });
  if (!store) {
    return NextResponse.json({ error: "Unknown shop domain" }, { status: 404 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    await receiveWebhookEvent({ storeId: store.id, eventId, topic, payload });
  } catch (err) {
    if (err instanceof WebhookAlreadyProcessedError) {
      return NextResponse.json({ data: { duplicate: true } });
    }
    // A persistence failure has no durable event to retry, so request redelivery.
    // Processing failures are marked FAILED by the service and acknowledged.
    console.error("Shopify webhook processing failed:", err);
    const persisted = await db.webhookEvent.findUnique({
      where: { storeId_eventId: { storeId: store.id, eventId } },
      select: { status: true },
    }).catch(() => null);
    if (persisted?.status !== "FAILED") return NextResponse.json({ error: "Webhook not safely handled" }, { status: 503 });
    return NextResponse.json({ data: { received: true, processed: false } });
  }

  return NextResponse.json({ data: { received: true, processed: true } });
}
