import { NextRequest, NextResponse } from "next/server";
import { hashMobileToken, parseMobileAuthorization } from "@/lib/mobile-token";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const token = parseMobileAuthorization(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.mobileSession.updateMany({ where: { tokenHash: hashMobileToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  return NextResponse.json({ data: { signedOut: true } });
}
