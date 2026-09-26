import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { getBusinessReport } from "@/services/report.service";
import { RangeFilter } from "@/components/reports/RangeFilter";
import { SalesBars } from "@/components/reports/SalesBars";

type Params = { period?: string; from?: string; to?: string };
const number = (n: number) => n.toLocaleString("ar-EG", { maximumFractionDigits: 2 });
const card = "min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireAuth();
  if (!can(session.role, "reports.read")) throw new Error("Forbidden");
  const query = await searchParams;
  const r = await getBusinessReport(session.storeId, { period: query.period, from: query.from, to: query.to });
  const money = (n: number) => `${number(n)} ${r.currency}`;
  const sales = [
    ["الإجمالي", money(r.sales.gross)], ["الخصومات", money(r.sales.discounts)],
    ["المبالغ المستردة", money(r.sales.refunded)], ["الصافي", money(r.sales.net)],
    ["الطلبات", number(r.sales.orders)], ["الوحدات", number(r.sales.units)],
    ["متوسط قيمة الطلب", money(r.sales.averageOrderValue)],
  ];

  return <main className="mx-auto max-w-7xl min-w-0 space-y-6 p-4 md:p-8">
    <header><h1 className="text-2xl font-bold">التقارير</h1><p className="text-sm text-gray-600">{r.range.from} إلى {r.range.to} · {r.range.timeZone}</p></header>
    <RangeFilter base="/dashboard/reports" period={r.range.period} from={query.from} to={query.to} />
    {r.notes.excludedDifferentCurrencyOrders > 0 && <p className="rounded bg-amber-50 p-3 text-sm">المبيعات لا تشمل {r.notes.excludedDifferentCurrencyOrders} طلب بعملة غير {r.currency}.</p>}

    <section className={card}><h2 className="mb-4 text-lg font-semibold">المبيعات</h2><dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">{sales.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl><div className="mt-5"><SalesBars days={r.salesByDay} currency={r.currency} /></div><p className="mt-3 text-xs text-gray-500">مبالغ الاسترداد في تقرير المبيعات محسوبة بتاريخ الطلب الأصلي.</p></section>

    <section className={card}><h2 className="mb-4 text-lg font-semibold">الدفعات المستلمة من الطلبات اليدوية</h2><dl className="grid gap-3 text-sm sm:grid-cols-3">{[["الديبوزت عند تسجيل الطلب", money(r.cash.deposits)], ["باقي المبلغ عند التسليم", money(r.cash.deliveryBalances)], ["إجمالي المستلم", money(r.cash.received)]].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl><p className="mt-3 text-xs text-gray-500">يظهر الديبوزت في تاريخ تسجيل الطلب مهما كانت حالته، والباقي في تاريخ التسليم. الإجمالي قبل أي مبالغ مردودة، ويخص الطلبات اليدوية فقط.</p></section>

    <section className={card}><h2 className="mb-4 text-lg font-semibold">أداء المنتجات</h2>
      <div className="space-y-3 md:hidden">{r.products.map(p => <article key={p.key} className="min-w-0 rounded-xl border border-slate-100 p-3 text-sm"><h3 className="break-words font-semibold">{p.product} · {p.variant}</h3><p className="mt-2 text-slate-600">الوحدات: {number(p.units)} · الصافي: {money(p.net)}</p><details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-medium text-[#315b4c]">تفاصيل الأداء</summary><div className="mt-2 space-y-1"><p>إجمالي البنود: {money(p.gross)}</p><p>الخصومات: {money(p.discounts)} · الاسترداد: {money(p.refunds)}</p>{r.profitability && <p>التكلفة التقديرية: {money(p.estimatedCost)}</p>}</div></details></article>)}</div>
      <div className="hidden max-w-full overflow-x-auto md:block"><table className="w-full min-w-[750px] text-right text-sm"><thead><tr className="border-b text-gray-600"><th className="py-2">المنتج / الصنف</th><th>الوحدات</th><th>إجمالي البنود</th><th>الخصومات</th><th>الاسترداد</th><th>الصافي</th>{r.profitability && <th>التكلفة التقديرية</th>}</tr></thead><tbody>{r.products.map(p => <tr key={p.key} className="border-b"><td className="py-2">{p.product} · {p.variant}</td><td>{number(p.units)}</td><td>{money(p.gross)}</td><td>{money(p.discounts)}</td><td>{money(p.refunds)}</td><td>{money(p.net)}</td>{r.profitability && <td>{money(p.estimatedCost)}</td>}</tr>)}</tbody></table></div>
      {!r.products.length && <p className="py-4 text-sm text-gray-500">لا توجد بيانات.</p>}<p className="mt-2 text-xs text-gray-500">صافي البنود لا يشمل الشحن والضرائب، على عكس صافي الطلبات.</p>
    </section>

    <div className="grid min-w-0 gap-5 lg:grid-cols-2"><section className={card}><h2 className="mb-3 text-lg font-semibold">المرتجعات حسب تاريخها</h2><p className="break-words text-sm">{number(r.returns.count)} مرتجع · {number(r.returns.units)} وحدة · {money(r.returns.value)} قيمة · {money(r.returns.costs)} تكلفة</p><p className="mt-1 text-sm">أعيد للمخزون: {number(r.returns.restocked)} · لم يعد: {number(r.returns.notRestocked)}</p><h3 className="mt-4 font-medium">الأكثر إرجاعًا</h3>{r.returnedProducts.slice(0, 10).map((p, i) => <p key={i} className="break-words border-t py-2 text-sm">{p.product} · {p.variant}: {number(p.units)}</p>)}<h3 className="mt-4 font-medium">مرتجعات يوميًا</h3>{r.returnsByDay.map(d => <p key={d.date} className="border-t py-2 text-sm">{d.date}: {d.count} · {money(d.value)}</p>)}</section>
      <section className={card}><h2 className="mb-3 text-lg font-semibold">المصروفات</h2><p className="text-sm">الإجمالي: {money(r.expenses.total)} (يشمل تكلفة المرتجعات)</p><p className="mt-1 text-sm">تكاليف المرتجعات المسجلة: {money(r.expenses.returnCosts)} · مشتريات المواد: {money(r.expenses.materialPurchases)}</p>{r.expenses.byCategory.map(c => <p key={c.category} className="break-words border-t py-2 text-sm">{c.category}: {money(c.amount)}</p>)}<h3 className="mt-4 font-medium">أحدث السجلات</h3>{r.expenses.rows.slice(0, 15).map(e => <p key={e.id} className="break-words border-t py-2 text-sm">{new Date(e.date).toLocaleDateString("ar-EG")}: {e.category} · {money(e.amount)} · {e.description ?? e.reference ?? ""}</p>)}</section></div>

    <section className={card}><h2 className="mb-4 text-lg font-semibold">استهلاك المواد خلال الفترة</h2>
      <div className="space-y-2 md:hidden">{r.consumption.map(m => <div key={m.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 text-sm"><strong className="min-w-0 break-words">{m.name}</strong><span>{number(m.consumed)} {m.unit}</span><p className="w-full text-xs text-slate-500">طلبات: {m.orders} · أصناف: {m.products}</p></div>)}</div>
      <div className="hidden max-w-full overflow-x-auto md:block"><table className="w-full min-w-[550px] text-right text-sm"><thead><tr className="border-b"><th className="py-2">المادة</th><th>الكمية المستهلكة</th><th>طلبات</th><th>أصناف</th></tr></thead><tbody>{r.consumption.map(m => <tr key={m.id} className="border-b"><td className="py-2">{m.name}</td><td>{number(m.consumed)} {m.unit}</td><td>{m.orders}</td><td>{m.products}</td></tr>)}</tbody></table></div>
      {!r.consumption.length && <p className="py-4 text-sm text-gray-500">لا يوجد استهلاك خلال الفترة.</p>}
    </section>

    <section className={card}><h2 className="mb-4 text-lg font-semibold">المخزون الحالي وحركته خلال الفترة</h2>
      <div className="space-y-3 md:hidden">{r.inventory.map(m => <article key={m.id} className={`min-w-0 rounded-xl border border-slate-100 p-3 text-sm ${m.reorderLevel !== null && m.stock < m.reorderLevel ? "bg-amber-50" : ""}`}><div className="flex flex-wrap justify-between gap-2"><strong className="min-w-0 break-words">{m.name} · {m.type}</strong><span>الرصيد: {number(m.stock)} {m.unit}</span></div><details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-medium text-[#315b4c]">حركة المخزون</summary><div className="mt-2 grid grid-cols-2 gap-2"><span>الحد الأدنى: {m.reorderLevel ?? "—"}</span><span>مشتريات: {number(m.purchased)}</span><span>استهلاك: {number(m.consumed)}</span><span>هالك: {number(m.wasted)}</span><span>إعادة تخزين: {number(m.returned)}</span><span>تعديلات: {number(m.adjusted)}</span>{r.profitability && <span className="col-span-2">قيمة تقديرية: {m.estimatedValue === null ? "غير محددة" : money(m.estimatedValue)}</span>}</div></details></article>)}</div>
      <div className="hidden max-w-full overflow-x-auto md:block"><table className="w-full min-w-[850px] text-right text-sm"><thead><tr className="border-b"><th className="py-2">المادة</th><th>الرصيد الحالي</th><th>الحد الأدنى</th><th>مشتريات</th><th>استهلاك</th><th>هالك</th><th>إعادة تخزين</th><th>تعديلات</th>{r.profitability && <th>قيمة تقديرية</th>}</tr></thead><tbody>{r.inventory.map(m => <tr key={m.id} className={`border-b ${m.reorderLevel !== null && m.stock < m.reorderLevel ? "bg-amber-50" : ""}`}><td className="py-2">{m.name} · {m.type}</td><td>{number(m.stock)} {m.unit}</td><td>{m.reorderLevel ?? "—"}</td><td>{number(m.purchased)}</td><td>{number(m.consumed)}</td><td>{number(m.wasted)}</td><td>{number(m.returned)}</td><td>{number(m.adjusted)}</td>{r.profitability && <td>{m.estimatedValue === null ? "غير محددة" : money(m.estimatedValue)}</td>}</tr>)}</tbody></table></div>
      {!r.inventory.length && <p className="py-4 text-sm text-gray-500">لا توجد خامات مخزنة.</p>}
    </section>
    {r.profitability && <section className={card}><h2 className="font-semibold">ربحية تقديرية</h2><p className="mt-2 text-sm">صافي الطلبات: {money(r.sales.net)} · تكلفة المنتجات المستهلكة: {money(r.profitability.estimatedProductCost)} · الفرق: {money(r.profitability.estimatedGrossProfit)} · الهامش: {r.profitability.estimatedGrossMargin ?? "—"}%</p><p className="mt-2 text-xs text-amber-800">تقدير يعتمد على تكلفة المواد الافتراضية. {r.profitability.incomplete ? "بعض التكاليف أو استهلاك بنود الطلبات غير مكتمل؛ لا تعتمد هذا الرقم للقرار المالي." : "لا يشمل المصروفات التشغيلية؛ راجع تقرير المصروفات منفصلًا."}</p></section>}
  </main>;
}
