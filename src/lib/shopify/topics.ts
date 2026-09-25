/**
 * Webhook topics this app subscribes to at connect time
 * (see services/shopify/connection.service.ts → registerWebhooks).
 *
 * Values are the GraphQL `WebhookSubscriptionTopic` enum names, confirmed
 * against https://shopify.dev/docs/api/admin-graphql/2026-07/enums/WebhookSubscriptionTopic
 * at implementation time (2026). Re-verify this list against that page
 * whenever SHOPIFY_API_VERSION is bumped — Shopify adds/renames topics
 * across versions and the spec explicitly warns against assuming an old
 * list still applies.
 *
 * Coverage mirrors spec §53's intent: order lifecycle, refunds, product
 * changes, and app uninstall.
 */
export const SUBSCRIBED_WEBHOOK_TOPICS = [
  "ORDERS_CREATE",
  "ORDERS_UPDATED",
  "ORDERS_CANCELLED",
  "ORDERS_PAID",
  "REFUNDS_CREATE",
  "PRODUCTS_CREATE",
  "PRODUCTS_UPDATE",
  "APP_UNINSTALLED",
] as const;

export type SubscribedWebhookTopic = (typeof SUBSCRIBED_WEBHOOK_TOPICS)[number];

/**
 * Shopify still delivers the `X-Shopify-Topic` header in the REST-style
 * lowercase/slash form (e.g. "orders/create") regardless of whether the
 * subscription was created via GraphQL or REST. This maps that header
 * value to our enum above for dispatch in the webhook route.
 */
export function normalizeWebhookTopicHeader(header: string): SubscribedWebhookTopic | null {
  const normalized = header.trim().toUpperCase().replace(/\//g, "_");
  return (SUBSCRIBED_WEBHOOK_TOPICS as readonly string[]).includes(normalized)
    ? (normalized as SubscribedWebhookTopic)
    : null;
}
