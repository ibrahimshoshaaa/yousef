import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { retryFailedEvent } from "@/services/shopify/webhook.service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "shopify.write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storeId = getStoreId(session);
    const { eventId } = await params;

    await retryFailedEvent(storeId, eventId);
    return NextResponse.json({ data: { status: "ok" } });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "Failed webhook event not found") {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "Retry failed" }, { status: 500 });
  }
}
