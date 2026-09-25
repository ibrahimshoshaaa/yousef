import { NextRequest, NextResponse } from "next/server";
import { getConfig, getShopifyConfig } from "@/lib/config";
import {
  isValidShopDomain,
  verifyOAuthCallbackHmac,
  exchangeAccessToken,
} from "@/lib/shopify/oauth";
import { verifyOAuthState } from "@/lib/shopify/state";
import { ShopifyClient } from "@/lib/shopify/client";
import { saveConnection, markConnectionError } from "@/services/shopify/connection.service";
import { runFullSync } from "@/services/shopify/sync.service";

/**
 * Browser lands here straight from Shopify — no session cookies of ours to
 * rely on (see lib/shopify/state.ts for why `state` carries the storeId
 * instead). Every step below must fail closed: a bad HMAC, an expired or
 * forged state, or a shop domain that doesn't match a real Shopify format
 * must stop the flow before any token exchange happens.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const { AUTH_SECRET, NEXT_PUBLIC_APP_URL } = getConfig();

  let shopifyConfig;
  try {
    shopifyConfig = getShopifyConfig();
  } catch {
    return errorRedirect(NEXT_PUBLIC_APP_URL, "shopify_not_configured");
  }

  const shop = url.searchParams.get("shop");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!shop || !isValidShopDomain(shop) || !code || !state) {
    return errorRedirect(NEXT_PUBLIC_APP_URL, "invalid_callback");
  }

  if (!verifyOAuthCallbackHmac(url.searchParams, shopifyConfig.apiSecret)) {
    return errorRedirect(NEXT_PUBLIC_APP_URL, "invalid_hmac");
  }

  const decodedState = verifyOAuthState(state, AUTH_SECRET);
  if (!decodedState) {
    return errorRedirect(NEXT_PUBLIC_APP_URL, "invalid_state");
  }

  const { storeId } = decodedState;

  try {
    const tokenResponse = await exchangeAccessToken({ shop, code, config: shopifyConfig });

    const client = new ShopifyClient(shop, tokenResponse.access_token, shopifyConfig.apiVersion);
    const shopInfo = await client.fetchShop();

    await saveConnection({
      storeId,
      shopDomain: shop,
      accessToken: tokenResponse.access_token,
      scope: tokenResponse.scope,
      shopifyShopId: shopInfo.id,
    });

    // Runs inline (no queue — spec forbids Redis/BullMQ). Large catalogs
    // may take a while; failures are recorded on SyncState/SyncJob and
    // surfaced on the connection dashboard rather than blocking the redirect.
    try {
      await runFullSync(storeId);
    } catch (syncErr) {
      console.error("Initial Shopify sync failed:", syncErr);
    }

    return NextResponse.redirect(`${NEXT_PUBLIC_APP_URL}/dashboard/shopify?connected=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markConnectionError(storeId, message).catch(() => {});
    console.error("Shopify OAuth callback failed:", err);
    return errorRedirect(NEXT_PUBLIC_APP_URL, "connection_failed");
  }
}

function errorRedirect(appUrl: string, reason: string) {
  return NextResponse.redirect(`${appUrl}/dashboard/shopify?error=${reason}`);
}
