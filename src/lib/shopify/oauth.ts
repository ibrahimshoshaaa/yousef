/**
 * OAuth for a custom/private Shopify app. These endpoints
 * (`/admin/oauth/authorize`, `/admin/oauth/access_token`) are unversioned
 * per https://shopify.dev/docs/api/usage/versioning — unaffected by the
 * REST → GraphQL Admin API migration, so no API version is passed here.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { ShopifyConfig } from "@/lib/config";

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function isValidShopDomain(shop: string): boolean {
  return SHOP_DOMAIN_RE.test(shop.toLowerCase());
}

export function buildAuthorizeUrl(params: {
  shop: string;
  config: ShopifyConfig;
  state: string;
}): string {
  const { shop, config, state } = params;
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", config.apiKey);
  url.searchParams.set("scope", config.scopes.join(","));
  url.searchParams.set("redirect_uri", `${config.appUrl}/api/shopify/callback`);
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Verifies the HMAC Shopify appends to every query string it sends us
 * (install callback, and any embedded-app load), per
 * https://shopify.dev/docs/apps/build/authentication-authorization/oauth-access-tokens#verify-requests
 */
export function verifyOAuthCallbackHmac(
  searchParams: URLSearchParams,
  apiSecret: string
): boolean {
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;

  const pairs: string[] = [];
  for (const [key, value] of searchParams.entries()) {
    if (key === "hmac" || key === "signature") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort((a, b) => a.localeCompare(b, "en"));
  const message = pairs.join("&");

  const digest = createHmac("sha256", apiSecret).update(message).digest("hex");

  const a = Buffer.from(digest);
  const b = Buffer.from(hmac);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type ShopifyOAuthTokenResponse = {
  access_token: string;
  scope: string;
};

export async function exchangeAccessToken(params: {
  shop: string;
  code: string;
  config: ShopifyConfig;
}): Promise<ShopifyOAuthTokenResponse> {
  const { shop, code, config } = params;

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.apiKey,
      client_secret: config.apiSecret,
      code,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shopify token exchange failed (${res.status}): ${text}`);
  }

  return res.json();
}
