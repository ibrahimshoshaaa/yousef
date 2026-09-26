import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { AdjustInventoryForm } from "@/components/materials/AdjustInventoryForm";

const txTypeLabels: Record<string, string> = {
  ADJUSTMENT_IN: "تسوية إضافة", ADJUSTMENT_OUT: "تسوية خصم", CONSUMPTION: "استهلاك",
  PURCHASE: "شراء", RETURN_RESTOCK: "إرجاع للمخزون", WASTE: "هالك", OPENING: "رصيد افتتاحي",
};
const incoming = new Set(["ADJUSTMENT_IN", "PURCHASE", "RETURN_RESTOCK", "OPENING"]);
const format = (value: number) => value.toLocaleString("ar-EG", { maximumFractionDigits: 3 });

export default async function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!can(session.role, "materials.read")) throw new Error("Forbidden");
  const { id } = await params;
  const material = await db.material.findFirst({
    where: { id, storeId: session.storeId },
    include: { materialType: true, supplier: true, balance: true },
  });
  if (!material) notFound();
  const history = await db.inventoryTransaction.findMany({
    where: { storeId: session.storeId, materialId: id }, orderBy: { createdAt: "desc" }, take: 50,
  });
  const balance = Number(material.balance?.quantity ?? 0);
  const reorder = material.reorderLevel === null ? null : Number(material.reorderLevel);
  const isLow = reorder !== null && balance < reorder;

  return <main className="mx-auto max-w-5xl space-y-4 px-4 py-4 sm:space-y-6 sm:px-8 sm:py-8">
    <header className="space-y-2">
      <Link href="/dashboard/inventory" className="inline-flex min-h-9 items-center text-sm font-semibold text-[#315b4c] hover:underline">→ رجوع للمخزون</Link>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{material.name}</h1><p className="mt-1 text-sm text-slate-500">{material.materialType.name}{material.supplier ? ` · ${material.supplier.name}` : ""}{material.sku ? ` · ${material.sku}` : ""}</p></div>{isLow && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">يحتاج إعادة شراء</span>}</div>
    </header>
    <section aria-label="رصيد الخامة" className={`rounded-2xl border p-4 shadow-sm sm:p-6 ${isLow ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <p className="text-sm text-slate-600">الرصيد الحالي</p><strong className={`mt-1 block text-3xl font-bold tabular-nums ${isLow ? "text-amber-900" : "text-[#263b35]"}`}>{format(balance)} <span className="text-lg">{material.unit}</span></strong>
      {reorder !== null && <p className="mt-2 text-xs text-slate-500">حد إعادة الشراء: {format(reorder)} {material.unit}</p>}
    </section>
    {(material.defaultCost !== null || material.capacityMl !== null) && <section aria-label="بيانات الخامة" className="grid grid-cols-2 gap-2 sm:gap-3">
      {material.defaultCost !== null && <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4"><p className="text-xs text-slate-500">التكلفة الافتراضية</p><strong className="mt-1 block break-words text-base text-slate-900">{format(Number(material.defaultCost))} EGP</strong></div>}
      {material.capacityMl !== null && <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4"><p className="text-xs text-slate-500">السعة</p><strong className="mt-1 block text-base text-slate-900">{format(Number(material.capacityMl))} مل</strong></div>}
    </section>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5"><h2 className="font-bold">حركة المخزون</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">آخر {history.length} حركة</span></div>
      {history.length ? <div className="max-h-[600px] divide-y divide-slate-100 overflow-y-auto px-4 sm:px-5">{history.map((txn) => {
        const isIn = incoming.has(txn.type);
        return <article key={txn.id} className="flex min-w-0 items-start justify-between gap-3 py-3 text-sm">
          <div className="min-w-0"><h3 className="font-semibold text-slate-900">{txTypeLabels[txn.type] ?? txn.type}</h3>{txn.reason && <p className="mt-1 break-words text-xs text-slate-600">{txn.reason}</p>}<time className="mt-1 block text-xs text-slate-400" dateTime={txn.createdAt.toISOString()}>{new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(txn.createdAt)}</time></div>
          <strong dir="ltr" className={`shrink-0 rounded-lg px-2 py-1 text-xs tabular-nums sm:text-sm ${isIn ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{isIn ? "+" : "−"}{format(Number(txn.quantity))} {txn.unit}</strong>
        </article>;
      })}</div> : <p className="p-6 text-sm text-slate-500">لا توجد حركات لهذه الخامة بعد.</p>}
    </section>
    {can(session.role, "inventory.write") && <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><summary className="cursor-pointer font-bold text-[#263b35]">تسوية الرصيد يدويًا</summary><p className="mb-4 mt-2 text-xs text-slate-500">للتصحيح والجرد. لتسجيل مشتريات جديدة وتكلفتها استخدم «إضافة مخزون» من صفحة المخزون.</p><AdjustInventoryForm materialId={material.id} materialName={material.name} unit={material.unit} currentBalance={balance} /></details>}
  </main>;
}
