import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
export async function GET(req: NextRequest) {
  try { const session = await requireAuth(); if (session.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const page = Number(req.nextUrl.searchParams.get("page") ?? "1"); if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return NextResponse.json({ error: "Invalid page" }, { status: 422 }); const rows = await db.auditLog.findMany({ where: { storeId: session.storeId }, select: { id: true, userId: true, action: true, entity: true, entityId: true, createdAt: true, metadata: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }); return NextResponse.json({ data: rows, page }); }
  catch (error) { if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); console.error(error); return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
