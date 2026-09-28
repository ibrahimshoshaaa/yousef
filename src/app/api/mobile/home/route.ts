import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { getBusinessReport } from "@/services/report.service";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "dashboard.read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const params = new URL(request.url).searchParams;
    const data = await getBusinessReport(session.storeId, { period: params.get("period") ?? undefined,
      from: params.get("from") ?? undefined, to: params.get("to") ?? undefined });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error instanceof Error && /Invalid (period|date range)/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 422 });
    throw error;
  }
}
