import { NextRequest, NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

const schema = z.object({
  name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128), currentPassword: z.string().min(1).max(1024),
});

export async function GET() {
  try {
    const session = await requireAuth();
    if (session.role !== "OWNER") return NextResponse.json({ error: "غير مسموح بإدارة المستخدمين" }, { status: 403 });
    const data = await db.user.findMany({ where: { storeId: session.storeId },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (session.role !== "OWNER") return NextResponse.json({ error: "غير مسموح بإضافة أدمن" }, { status: 403 });
    const input = schema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "راجع الاسم والبريد وكلمة المرور (١٢ حرفًا على الأقل)" }, { status: 422 });
    const actor = await db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { passwordHash: true } });
    if (!actor.passwordHash || !await compare(input.data.currentPassword, actor.passwordHash)) {
      return NextResponse.json({ error: "كلمة مرور حسابك الحالية غير صحيحة" }, { status: 403 });
    }
    const email = input.data.email.toLowerCase();
    const passwordHash = await hash(input.data.password, 12);
    const user = await db.$transaction(async tx => {
      const created = await tx.user.create({ data: { storeId: session.storeId, name: input.data.name,
        email, passwordHash, role: "OWNER", status: "ACTIVE" },
        select: { id: true, name: true, email: true, role: true, status: true } });
      await tx.auditLog.create({ data: { storeId: session.storeId, userId: session.userId,
        action: "CREATE_OWNER", entity: "User", entityId: created.id,
        after: { email: created.email, role: created.role } } });
      return created;
    });
    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "البريد الإلكتروني مسجل بالفعل" }, { status: 409 });
    return failure(error);
  }
}

function failure(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "سجّل الدخول أولًا" }, { status: 401 });
  console.error("Account users failed", error);
  return NextResponse.json({ error: "تعذر إدارة المستخدمين" }, { status: 500 });
}
