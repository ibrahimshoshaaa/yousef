import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getSetting } from "@/lib/settings";
import { can } from "@/lib/rbac";
import { MaterialTypesSettings } from "@/components/materials/MaterialTypesSettings";

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  defaultReturnCost: z.coerce.number().finite().min(0).max(1000000),
  costingEnabled: z.boolean(),
});

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const session = await requireAuth();
  const [store, returnCost, costingEnabled, materialTypes] = await Promise.all([
    db.store.findUniqueOrThrow({ where: { id: session.storeId }, select: { name: true, currency: true, timezone: true, createdAt: true } }),
    getSetting(session.storeId, "defaultReturnCost"),
    getSetting(session.storeId, "costingEnabled"),
    db.materialType.findMany({ where: { storeId: session.storeId, active: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);
  const params = await searchParams;

  async function save(form: FormData) {
    "use server";
    const actor = await requireAuth();
    if (actor.role !== "OWNER") throw new Error("Forbidden");
    const parsed = settingsSchema.safeParse({
      name: form.get("name"),
      defaultReturnCost: form.get("defaultReturnCost"),
      costingEnabled: form.get("costingEnabled") === "on",
    });
    if (!parsed.success) redirect("/dashboard/settings?error=invalid");
    const value = parsed.data;
    await db.$transaction(async tx => {
      const before = await tx.store.findUniqueOrThrow({ where: { id: actor.storeId }, select: { name: true } });
      await tx.store.update({ where: { id: actor.storeId }, data: { name: value.name } });
      for (const [key, next] of [["defaultReturnCost", String(value.defaultReturnCost)], ["costingEnabled", String(value.costingEnabled)]] as const) {
        const previous = await tx.setting.findUnique({ where: { storeId_key: { storeId: actor.storeId, key } } });
        await tx.setting.upsert({ where: { storeId_key: { storeId: actor.storeId, key } }, update: { value: next }, create: { storeId: actor.storeId, key, value: next } });
        if (previous?.value !== next) await tx.auditLog.create({ data: { storeId: actor.storeId, userId: actor.userId, action: "UPDATE", entity: "Setting", entityId: key, before: { value: previous?.value ?? null }, after: { value: next } } });
      }
      if (before.name !== value.name) await tx.auditLog.create({ data: { storeId: actor.storeId, userId: actor.userId, action: "UPDATE", entity: "Store", entityId: actor.storeId, before: { name: before.name }, after: { name: value.name } } });
    });
    redirect("/dashboard/settings?saved=1");
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-9">
      <header><p className="text-sm font-semibold text-[#96723c]">إدارة المتجر</p><h1 className="mt-1 text-3xl font-bold tracking-tight">الإعدادات</h1><p className="mt-2 text-sm text-slate-500">بيانات المتجر وخيارات المحاسبة الأساسية.</p></header>
      {params.saved && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">تم حفظ الإعدادات بنجاح.</p>}
      {params.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">تحقق من اسم المتجر وتكلفة المرتجع ثم حاول مرة أخرى.</p>}
      <form action={save} className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-semibold">بيانات المتجر</h2>
          <p className="mt-1 text-sm text-slate-500">الاسم الظاهر في لوحة التحكم.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium">اسم المتجر<input name="name" required minLength={2} maxLength={80} defaultValue={store.name} disabled={session.role !== "OWNER"} className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#96723c] disabled:bg-slate-50" /></label>
            <div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-4"><span className="text-slate-500">العملة</span><strong className="mt-2 block">{store.currency}</strong></div><div className="rounded-xl bg-slate-50 p-4"><span className="text-slate-500">المنطقة الزمنية</span><strong className="mt-2 block text-xs">{store.timezone}</strong></div></div>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-semibold">التكاليف</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <label className="block text-sm font-medium">تكلفة المرتجع الافتراضية ({store.currency})<input name="defaultReturnCost" required type="number" min="0" max="1000000" step="0.01" defaultValue={returnCost} disabled={session.role !== "OWNER"} className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#96723c] disabled:bg-slate-50" /><span className="mt-2 block text-xs font-normal text-slate-500">تُسجّل هذه التكلفة ضمن مصروفات المرتجع عند المعالجة.</span></label>
            <label aria-label="إظهار التكلفة التقديرية" className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm"><input name="costingEnabled" type="checkbox" defaultChecked={costingEnabled === "true"} disabled={session.role !== "OWNER"} className="mt-1 size-4 accent-[#263b35]" /><span><strong className="block">إظهار التكلفة التقديرية</strong><span className="mt-1 block leading-6 text-slate-500">تعرض تقدير تكلفة الوصفات وهوامش الربح عند توفر أسعار المواد.</span></span></label>
          </div>
        </section>
        {session.role === "OWNER" ? <button type="submit" className="rounded-xl bg-[#263b35] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#345348]">حفظ التغييرات</button> : <p className="text-sm text-slate-500">تعديل هذه الإعدادات متاح لمالك المتجر فقط.</p>}
      </form>
      {can(session.role, "materials.write") && <MaterialTypesSettings initialTypes={materialTypes} />}
    </main>
  );
}
