import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { getBusinessReport } from "@/services/report.service";
import { RangeFilter } from "@/components/reports/RangeFilter";
import { SalesBars } from "@/components/reports/SalesBars";

type Params = { period?: string; from?: string; to?: string };
const money = (value: number, currency: string) => `${Number(value).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireAuth();
  if (!can(session.role, "dashboard.read")) throw new Error("Forbidden");
  const query = await searchParams;
  const report = await getBusinessReport(session.storeId, { period: query.period, from: query.from, to: query.to });
  const currency = report.currency;
  const cards = [
    { label: "إجمالي المبيعات", value: money(report.sales.gross, currency), mark: "↗" },
    { label: "صافي المبيعات", value: money(report.sales.net, currency), mark: "◈" },
    { label: "الدفعات المستلمة من الطلبات اليدوية", value: money(report.cash.received, currency), mark: "●", hint: `ديبوزت ${money(report.cash.deposits, currency)} · باقي الطلبات المسلّمة ${money(report.cash.deliveryBalances, currency)}؛ قبل أي ردّ مبالغ` },
    { label: "الطلبات", value: String(report.sales.orders), mark: "◫" },
    { label: "الوحدات المباعة", value: String(report.sales.units), mark: "▤" },
    { label: "المرتجعات", value: String(report.returns.count), mark: "↶" },
    { label: "تكلفة المرتجعات", value: money(report.returns.costs, currency), mark: "◌" },
    { label: "المصروفات", value: money(report.expenses.total, currency), mark: "◇", hint: "تشمل تكلفة المرتجعات" },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-6 sm:px-8 sm:py-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-[#96723c]">نظرة عامة</p><h1 className="mt-1 text-3xl font-bold tracking-tight">لوحة التحكم</h1><p className="mt-2 text-sm text-slate-500">من {report.range.from} إلى {report.range.to} · {report.range.timeZone}</p></div>
        <Link href="/dashboard/reports" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#315b4c] hover:border-[#315b4c]">عرض التقارير ←</Link>
      </header>
      <section aria-label="وصول سريع" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-base font-bold text-slate-900">وصول سريع</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {can(session.role, "orders.write") && <Link href="/dashboard/orders/new" className="flex min-h-14 items-center justify-center rounded-xl bg-[#263b35] px-2 py-3 text-center text-sm font-semibold text-white hover:bg-[#345348]">+ تسجيل طلب</Link>}
          {can(session.role, "products.write") && <Link href="/dashboard/products/new" className="flex min-h-14 items-center justify-center rounded-xl border border-slate-200 px-2 py-3 text-center text-sm font-semibold text-[#263b35] hover:bg-slate-50">+ إضافة منتج</Link>}
          {can(session.role, "inventory.write") && can(session.role, "expenses.write") && can(session.role, "materials.write") && <Link href="/dashboard/inventory?add=1" className="flex min-h-14 items-center justify-center rounded-xl border border-slate-200 px-2 py-3 text-center text-sm font-semibold text-[#263b35] hover:bg-slate-50">+ إضافة مخزون</Link>}
          {can(session.role, "expenses.write") && <Link href="/dashboard/expenses?add=1" className="flex min-h-14 items-center justify-center rounded-xl border border-slate-200 px-2 py-3 text-center text-sm font-semibold text-[#263b35] hover:bg-slate-50">+ إضافة مصروف</Link>}
          {can(session.role, "orders.read") && <Link href="/dashboard/orders" className="flex min-h-14 items-center justify-center rounded-xl border border-slate-200 px-2 py-3 text-center text-sm font-semibold text-[#263b35] hover:bg-slate-50">الطلبات</Link>}
          {can(session.role, "returns.read") && <Link href="/dashboard/returns" className="flex min-h-14 items-center justify-center rounded-xl border border-slate-200 px-2 py-3 text-center text-sm font-semibold text-[#263b35] hover:bg-slate-50">المرتجعات</Link>}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="اختيار الفترة">
        <RangeFilter base="/dashboard" period={report.range.period} from={query.from} to={query.to} />
      </section>
      {report.notes.excludedDifferentCurrencyOrders > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">تم استبعاد {report.notes.excludedDifferentCurrencyOrders} طلب بعملة مختلفة عن {currency} من المبيعات.</p>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="مؤشرات الأداء">
        {cards.map(card => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2"><p className="text-sm text-slate-500">{card.label}</p><span aria-hidden="true" className="flex size-9 items-center justify-center rounded-xl bg-[#f7f2e8] text-lg text-[#96723c]">{card.mark}</span></div>
            <strong className="mt-5 block text-2xl font-bold tabular-nums tracking-tight">{card.value}</strong>
            {"hint" in card && <p className="mt-2 text-xs text-slate-400">{card.hint}</p>}
          </div>
        ))}
      </section>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-bold">صافي المبيعات يوميًا</h2><p className="mt-1 text-xs text-slate-500">تطور المبيعات خلال الفترة المختارة</p><div className="mt-6"><SalesBars days={report.salesByDay} currency={currency} /></div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-bold">أفضل المنتجات</h2><p className="mt-1 text-xs text-slate-500">حسب صافي مبيعات الطلبات</p><div className="mt-5 divide-y divide-slate-100">{report.products.slice(0, 6).map(p => <div key={p.key} className="flex justify-between gap-3 py-3 text-sm"><span className="min-w-0 truncate">{p.product} · {p.variant}</span><strong className="shrink-0">{money(p.net, currency)}</strong></div>)}{!report.products.length && <p className="py-10 text-center text-sm text-slate-500">لا توجد بيانات مبيعات بعد.</p>}</div></section>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">تنبيهات المخزون</h2><Link href="/dashboard/inventory" className="text-sm font-medium text-[#315b4c] hover:underline">عرض المخزون ←</Link></div><div className="mt-5 flex flex-wrap gap-2">{report.lowStock.map(item => <span key={item.id} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{item.name}: {item.stock} {item.unit} (الحد {item.reorderLevel})</span>)}{!report.lowStock.length && <p className="py-3 text-sm text-slate-500">لا توجد تنبيهات مخزون حاليًا.</p>}</div></section>
    </main>
  );
}
