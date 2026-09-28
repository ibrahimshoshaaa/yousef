import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const session = await requireAuth();
    const user = await db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { id: true, name: true, email: true, role: true, store: { select: { name: true, currency: true, timezone: true } } } });
    return NextResponse.json({ data: user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw error;
  }
}
