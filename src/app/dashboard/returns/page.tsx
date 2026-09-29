import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { listReturns } from "@/services/finance.service";
import { ReturnProcessForm } from "@/components/finance/ReturnProcessForm";

export default async function ReturnsPage() {
  const session = await requireAuth();
  if (!can(session.role, "returns.read")) throw new Error("Forbidden");
  const store = await db.store.findUnique({ where: { id: session.storeId } });
  const returns = store ? await listReturns(store.id) : [];
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-8 sm:py-9">
    <header><p className="text-sm font-semibold text-[#8a6b30]">المبيعات</p><h1 className="mt-1 text-3xl font-bold text-[#191735]">المرتجعات</h1><p className="mt-2 text-sm text-slate-500">تفاصيل الطلب والمنتجات وتكلفة الإرجاع وحركة إعادة المخزون.</p></header>
    <section className="rounded-3xl bg-[#191735] p-6 text-white"><p className="text-sm text-[#d9d6ed]">إجمالي المرتجعات</p><strong className="mt-3 block text-3xl">{returns.length}</strong></section>
    <div className="space-y-4">{returns.map(ret => <details key={ret.id} className="group rounded-2xl border border-[#e5e4ec] bg-white p-5 shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 marker:hidden [&::-webkit-details-marker]:hidden"><div><h2 className="font-bold text-[#191735]">طلب #{ret.order.orderNumber ?? ret.orderId.slice(-8)}</h2><p className="mt-1 text-sm text-slate-500">{ret.order.customerRef || "عميل غير متاح"} · {ret.createdAt.toLocaleDateString("ar-EG")}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">{ret.processedAt ? "تمت المعالجة" : "بانتظار المعالجة"}</span><span aria-hidden="true" className="group-open:rotate-180">⌄</span></div></summary>
      <div className="mt-4 space-y-3 border-t border-[#e5e4ec] pt-4 text-sm text-slate-700"><p>المبلغ المرتجع: <strong>{Number(ret.totalAmount ?? 0)} {ret.order.currency}</strong></p><p>المنتجات: {ret.items.map(item => `${item.orderItem.title} × ${Number(item.quantity)}`).join("، ") || "غير متاحة"}</p>{ret.reason && <p>السبب: {ret.reason}</p>}
        {ret.processedAt ? <p className="rounded-xl bg-[#f4f5fa] p-3">تكلفة الإرجاع المسجلة: {Number(ret.returnCost)} {store?.currency}</p> : ret.items.length && can(session.role, "returns.write") ? <ReturnProcessForm returnId={ret.id} items={ret.items.map(item => ({ id: item.id, title: item.orderItem.title, quantity: Number(item.quantity) }))} /> : <p>لا توجد بنود للمعالجة؛ راجع مزامنة الطلب.</p>}
      </div>
    </details>)}</div>
    {!returns.length && <p className="rounded-2xl border border-dashed border-[#deddea] bg-white p-10 text-center text-sm text-slate-500">لا توجد مرتجعات بعد.</p>}
  </main>;
}
