/**
 * Verifies the `X-Shopify-Hmac-Sha256` header Shopify sends with every
 * webhook delivery. Must run against the *raw* request body — parsing to
 * JSON first and re-serializing will not reproduce the same bytes Shopify
 * signed, so callers must read the body as text before this check.
 *
 * Spec §53: "Unverified payloads must never reach business processing."
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyShopifyWebhookHmac(
  rawBody: string,
  hmacHeader: string | null,
  secret: string
): boolean {
  if (!hmacHeader) return false;

  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
