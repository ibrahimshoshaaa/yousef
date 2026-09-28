import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { requireAuth } from "@/lib/auth-helpers";

const schema = z.object({ name: z.string().trim().min(2).max(80),
  defaultReturnCost: z.number().finite().min(0).max(1000000), costingEnabled: z.boolean() });

export async function GET() {
  try {
    const session = await requireAuth();
    const [store, returnCost, costingEnabled] = await Promise.all([
      db.store.findUniqueOrThrow({ where: { id: session.storeId },
        select: { name: true, currency: true, timezone: true } }),
      getSetting(session.storeId, "defaultReturnCost"),
      getSetting(session.storeId, "costingEnabled"),
    ]);
    return NextResponse.json({ data: { ...store, defaultReturnCost: Number(returnCost),
      costingEnabled: costingEnabled === "true" } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (session.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const input = schema.parse(await request.json());
    await db.$transaction(async tx => {
      const store = await tx.store.findUniqueOrThrow({ where: { id: session.storeId }, select: { name: true } });
      await tx.store.update({ where: { id: session.storeId }, data: { name: input.name } });
      if (store.name !== input.name) await tx.auditLog.create({ data: { storeId: session.storeId,
        userId: session.userId, action: "UPDATE", entity: "Store", entityId: session.storeId,
        before: { name: store.name }, after: { name: input.name } } });
      for (const [key, value] of [["defaultReturnCost", String(input.defaultReturnCost)],
        ["costingEnabled", String(input.costingEnabled)]]) {
        const before = await tx.setting.findUnique({ where: { storeId_key: { storeId: session.storeId, key } } });
        await tx.setting.upsert({ where: { storeId_key: { storeId: session.storeId, key } },
          create: { storeId: session.storeId, key, value }, update: { value } });
        if (before?.value !== value) await tx.auditLog.create({ data: { storeId: session.storeId,
          userId: session.userId, action: "UPDATE", entity: "Setting", entityId: key,
          before: { value: before?.value ?? null }, after: { value } } });
      }
    });
    return NextResponse.json({ data: { saved: true } });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: "بيانات الإعدادات غير صحيحة", issues: error.issues }, { status: 422 });
  if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  console.error("Mobile settings failed", error);
  return NextResponse.json({ error: "تعذر تحميل الإعدادات" }, { status: 500 });
}
