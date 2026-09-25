import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getInventoryReconciliation } from "@/services/reconciliation.service";
export async function GET() {
  try { const session = await requireAuth(); if (session.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 }); return NextResponse.json({ data: await getInventoryReconciliation(session.storeId) }); }
  catch (error) { if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); console.error(error); return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
