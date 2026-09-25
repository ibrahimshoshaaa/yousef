import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { getBusinessReport } from "@/services/report.service";
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "reports.read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const query = req.nextUrl.searchParams;
    return NextResponse.json({ data: await getBusinessReport(session.storeId, { period: query.get("period") ?? undefined, from: query.get("from") ?? undefined, to: query.get("to") ?? undefined }) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error instanceof Error && /Invalid (period|date range)/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error(error); return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
