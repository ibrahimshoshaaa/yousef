import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { getConfig, getShopifyConfig } from "@/lib/config";
import { isValidShopDomain, buildAuthorizeUrl } from "@/lib/shopify/oauth";
import { createOAuthState } from "@/lib/shopify/state";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "shopify.write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const shop = new URL(req.url).searchParams.get("shop")?.trim().toLowerCase();
    if (!shop || !isValidShopDomain(shop)) {
      return NextResponse.json(
        { error: "Provide a valid shop domain, e.g. your-store.myshopify.com" },
        { status: 422 }
      );
    }

    const shopifyConfig = getShopifyConfig();
    const { AUTH_SECRET } = getConfig();
    const storeId = getStoreId(session);

    const state = createOAuthState(storeId, AUTH_SECRET);
    const authorizeUrl = buildAuthorizeUrl({ shop, config: shopifyConfig, state });

    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (err instanceof Error && /SHOPIFY_/.test(err.message)) {
    return NextResponse.json(
      { error: "Shopify app is not configured on this server yet", detail: err.message },
      { status: 501 }
    );
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
