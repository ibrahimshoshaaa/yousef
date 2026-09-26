import Link from "next/link";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

const PAGE_SIZE = 20;
const financialLabels: Record<string, string> = {
  PAID: "مدفوع", PENDING: "معلّق", PARTIALLY_PAID: "مدفوع جزئيًا",
  REFUNDED: "مسترد", PARTIALLY_REFUNDED: "مسترد جزئيًا", VOIDED: "ملغي",
};
const fulfillmentLabels: Record<string, string> = {
  FULFILLED: "تم الشحن", PARTIALLY_FULFILLED: "شحن جزئي", UNFULFILLED: "لم يُشحن",
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; manual?: string; attention?: string }> }) {
  const session = await requireAuth();
  if (!can(session.role, "orders.read")) throw new Error("Forbidden");
  const params = await searchParams;
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.page ?? "1", 10) || 1));
  const q = (params.q ?? "").trim().slice(0, 80);
  const where = { storeId: session.storeId, ...(q ? { orderNumber: { contains: q, mode: "insensitive" as const } } : {}) };
  const [orders, count] = await Promise.all([
    db.order.findMany({
      where, orderBy: { occurredAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { items: { select: { id: true, title: true, quantity: true, consumptionStatus: true } } },
    }),
    db.order.count({ where }),
  ]);
  const hasMore = page * PAGE_SIZE < count;
  const pageUrl = (p: number) => `/dashboard/orders?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-[#96723c]">المبيعات</p><h1 className="mt-1 text-3xl font-bold tracking-tight">الطلبات</h1><p className="mt-2 text-sm text-slate-500">تابع مبيعات المحل وطلبات Shopify من مكان واحد.</p></div>
        <div className="flex items-center gap-3">{can(session.role, "orders.write") && <Link href="/dashboard/orders/new" className="rounded-xl bg-[#263b35] px-5 py-3 text-sm font-semibold text-white hover:bg-[#345348]">+ تسجيل بيع يدوي</Link>}<span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">{count} طلب</span></div>
      </header>
      {params.manual === "created" && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">تم تسجيل البيع بنجاح، وهو ظاهر في المبيعات والتقارير.</p>}
      {params.manual === "created" && params.attention && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">لم يُخصم كل المخزون لهذا البيع. راجع <Link className="font-semibold underline" href={`/dashboard/consumption?orderId=${encodeURIComponent(params.attention)}`}>حالة الاستهلاك وسبب التعطّل</Link>.</p>}
      <form action="/dashboard/orders" className="flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="ابحث برقم الطلب" aria-label="ابحث برقم الطلب" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#96723c]" />
        <button type="submit" className="rounded-xl bg-[#263b35] px-5 py-3 text-sm font-medium text-white hover:bg-[#345348]">بحث</button>
      </form>
      {orders.length ? (
        <div className="space-y-3">
          {orders.map(order => (
            <details key={order.id} className="group min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 marker:hidden [&::-webkit-details-marker]:hidden sm:p-5">
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h2 className="break-all font-bold">طلب #{order.orderNumber ?? order.id.slice(-8)}</h2><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">{financialLabels[order.financialStatus ?? ""] ?? order.financialStatus ?? "الحالة غير محددة"}</span></div><p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(order.occurredAt)} · {order.items.length} بند · {Number(order.total ?? 0).toFixed(2)} {order.currency}</p></div>
                <span aria-hidden="true" className="shrink-0 text-lg text-slate-500 transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div className="space-y-3 border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5">
                <p className="text-sm text-slate-600">{order.shopifyId ? "Shopify" : "بيع يدوي"} · {fulfillmentLabels[order.fulfillmentStatus ?? ""] ?? order.fulfillmentStatus ?? "حالة الشحن غير محددة"}</p>
                <p className="text-sm text-slate-600">الإجمالي: <strong className="text-slate-900">{Number(order.total ?? 0).toFixed(2)} {order.currency}</strong> · صافي: {Number(order.netSales ?? 0).toFixed(2)} {order.currency}</p>
                <p className="mb-2 text-xs font-semibold text-slate-500">بنود الطلب ({order.items.length})</p>
                <div className="flex flex-wrap gap-2">{order.items.map(item => <span key={item.id} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-700">{item.title} × {Number(item.quantity)} <span className="text-slate-400">· {item.consumptionStatus}</span></span>)}</div>
                <Link href={`/dashboard/consumption?orderId=${order.id}`} className="mt-4 inline-block text-sm font-medium text-[#315b4c] hover:underline">عرض الاستهلاك ←</Link>
              </div>
            </details>
          ))}
        </div>
      ) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><div className="text-4xl text-[#c4a265]">◫</div><h2 className="mt-3 text-xl font-semibold">{q ? "لا توجد نتائج لهذا الرقم" : "لا توجد طلبات بعد"}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">{q ? "جرّب رقم طلب آخر أو امسح البحث." : "سجّل أول بيع يدوي من الزر بالأعلى، أو اربط Shopify لاستيراد الطلبات."}</p>{q && <Link className="mt-5 inline-block text-sm font-semibold text-[#315b4c] underline" href="/dashboard/orders">عرض كل الطلبات</Link>}</div>}
      {(page > 1 || hasMore) && <nav aria-label="صفحات الطلبات" className="flex items-center justify-center gap-3 text-sm">{page > 1 && <Link href={pageUrl(page - 1)} className="rounded-lg border bg-white px-4 py-2">السابق</Link>}<span>صفحة {page}</span>{hasMore && <Link href={pageUrl(page + 1)} className="rounded-lg border bg-white px-4 py-2">التالي</Link>}</nav>}
    </main>
  );
}
