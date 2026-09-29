import { NextRequest, NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

const schema = z.object({ currentPassword: z.string().min(1).max(1024), newPassword: z.string().min(12).max(128) });

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const input = schema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "كلمة المرور الجديدة يجب أن تكون ١٢ حرفًا على الأقل" }, { status: 422 });
    const user = await db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { passwordHash: true } });
    if (!user.passwordHash || !await compare(input.data.currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 403 });
    }
    if (input.data.currentPassword === input.data.newPassword) {
      return NextResponse.json({ error: "اختر كلمة مرور جديدة مختلفة" }, { status: 422 });
    }
    const passwordHash = await hash(input.data.newPassword, 12);
    await db.$transaction(async tx => {
      await tx.user.update({ where: { id: session.userId }, data: { passwordHash } });
      await tx.mobileSession.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { storeId: session.storeId, userId: session.userId,
        action: "CHANGE_PASSWORD", entity: "User", entityId: session.userId } });
    });
    return NextResponse.json({ data: { saved: true, signInAgain: true } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "سجّل الدخول أولًا" }, { status: 401 });
    console.error("Change password failed", error);
    return NextResponse.json({ error: "تعذر تغيير كلمة المرور" }, { status: 500 });
  }
}
