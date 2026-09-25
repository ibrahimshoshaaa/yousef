import { NextResponse } from "next/server";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { getConnectionStatus } from "@/services/shopify/connection.service";

export async function GET() {
  try {
    const session = await requireAuth();
    if (!can(session.role, "shopify.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storeId = getStoreId(session);
    const data = await getConnectionStatus(storeId);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
