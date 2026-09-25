import { NextResponse } from "next/server";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { runFullSync } from "@/services/shopify/sync.service";

export async function POST() {
  try {
    const session = await requireAuth();
    if (!can(session.role, "shopify.write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storeId = getStoreId(session);
    await runFullSync(storeId);
    return NextResponse.json({ data: { status: "ok" } });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "STORE_NOT_CONNECTED") {
      return NextResponse.json({ error: "Store is not connected to Shopify" }, { status: 409 });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: "Sync failed", detail: message }, { status: 500 });
  }
}
