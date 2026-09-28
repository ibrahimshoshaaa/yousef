import { NextRequest, NextResponse } from "next/server";
import { compare, hashSync } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "@/lib/login-throttle";
import { createMobileToken, hashMobileToken } from "@/lib/mobile-token";

const schema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(1024) });
const unknownUserHash = hashSync(randomBytes(32).toString("hex"), 12);

export async function POST(request: NextRequest) {
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 400 });
  const email = input.data.email.trim().toLowerCase();
  if (await isLoginBlocked(email)) return NextResponse.json({ error: "حاول مرة أخرى لاحقًا" }, { status: 429 });
  const user = await db.user.findUnique({ where: { email }, include: { store: true } });
  const valid = await compare(input.data.password, user?.passwordHash ?? unknownUserHash);
  if (!user || !valid || user.status !== "ACTIVE" || user.store.status !== "ACTIVE") {
    await recordLoginFailure(email);
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }
  await clearLoginFailures(email);
  const token = createMobileToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.$transaction([
    db.mobileSession.create({ data: { userId: user.id, storeId: user.storeId, tokenHash: hashMobileToken(token), expiresAt } }),
    db.auditLog.create({ data: { storeId: user.storeId, userId: user.id, action: "LOGIN", entity: "MobileSession", entityId: user.id } }),
  ]);
  return NextResponse.json({ data: { token, expiresAt: expiresAt.toISOString(), user: { id: user.id, name: user.name, email: user.email, role: user.role } } }, { headers: { "Cache-Control": "no-store" } });
}
