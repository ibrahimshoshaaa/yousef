import { Prisma } from "@prisma/client";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { listExpenses } from "@/services/finance.service";
import { ExpenseForms } from "@/components/finance/ExpenseForms";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ category?: string; add?: string }> }) {
  const session = await requireAuth();
  if (!can(session.role, "expenses.read")) throw new Error("Forbidden");
  const store = await db.store.findUnique({ where: { id: session.storeId } });
  const [expenses, categories] = store ? await Promise.all([
    listExpenses(store.id),
    db.expenseCategory.findMany({ where: { storeId: store.id, active: true }, orderBy: { name: "asc" } }),
  ]) : [[], []];
  const { category: requestedCategory, add } = await searchParams;
  // Historical expenses can belong to categories that are no longer active.
  const filterCategories = [...new Map([...categories, ...expenses.map((expense) => expense.category)].map((category) => [category.id, category])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const selectedCategory = filterCategories.some((category) => category.id === requestedCategory) ? requestedCategory : "";
  const visibleExpenses = selectedCategory ? expenses.filter((expense) => expense.categoryId === selectedCategory) : expenses;
  const total = expenses.reduce((sum, expense) => sum.plus(expense.amount), new Prisma.Decimal(0));
  const filteredTotal = visibleExpenses.reduce((sum, expense) => sum.plus(expense.amount), new Prisma.Decimal(0));
  const currency = store?.currency ?? "EGP";
  const formatAmount = (amount: Prisma.Decimal) => `${Number(amount).toLocaleString("ar-EG", { maximumFractionDigits: 4 })} ${currency}`;

  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-9">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold text-[#96723c]">المالية والمخزون</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">المصروفات</h1><p className="mt-2 text-sm text-slate-500">تابع مصروفات المتجر ومشتريات الخامات المسجلة تلقائيًا عند إضافة المخزون.</p></div>
      {can(session.role, "expenses.write") && <ExpenseForms categories={categories} currency={currency} initialOpen={add === "1"} />}
    </header>
    <section className="rounded-3xl bg-[#191735] p-6 text-white shadow-sm">
      <p className="text-sm text-[#d9d6ed]">إجمالي المصروفات</p><strong className="mt-3 block text-3xl font-bold" dir="ltr">{formatAmount(selectedCategory ? filteredTotal : total)}</strong><p className="mt-3 text-sm text-[#d9d6ed]">{visibleExpenses.length} مصروف {selectedCategory ? "في الفئة المحددة" : "مسجل"}</p>
    </section>
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-[#191735]">سجل المصروفات</h2>
        <form action="/dashboard/expenses" method="get" className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium text-slate-700">تصفية حسب الفئة<select name="category" defaultValue={selectedCategory} className="mt-2 block min-w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#96723c]"><option value="">كل الفئات</option>{filterCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <button type="submit" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">تطبيق</button>
        </form>
      </div>
      <div className="space-y-4">{visibleExpenses.map((expense) => <details key={expense.id} className="group rounded-2xl border border-[#e5e4ec] bg-white p-4 shadow-sm sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden [&::-webkit-details-marker]:hidden"><div className="min-w-0"><strong className="text-sm text-[#191735]">{expense.category.name}</strong><p className="mt-1 text-sm text-slate-500">{expense.return ? `تكلفة إرجاع طلب #${expense.return.order.orderNumber ?? expense.return.orderId.slice(-8)}` : expense.description || "مصروف مسجل"}</p><time className="mt-2 block text-xs text-slate-500" dateTime={expense.date.toISOString()}>{expense.date.toLocaleDateString("ar-EG")}</time></div><div className="flex shrink-0 items-center gap-2"><strong className="text-sm text-[#191735]">{Number(expense.amount).toLocaleString("ar-EG", { maximumFractionDigits: 4 })} {expense.currency}</strong><span aria-hidden="true" className="group-open:rotate-180">⌄</span></div></summary>
        <div className="mt-4 space-y-2 border-t border-[#e5e4ec] pt-4 text-sm text-slate-600">{expense.return ? <><p>الفاتورة: <strong>#{expense.return.order.orderNumber ?? expense.return.orderId.slice(-8)}</strong></p><p>العميل: {expense.return.order.customerRef || "غير متاح"}</p>{expense.return.order.customerPhone && <p>الهاتف: {expense.return.order.customerPhone}</p>}{expense.return.order.customerAddress && <p>العنوان: {expense.return.order.customerAddress}</p>}<p>الأصناف: {expense.return.items.map(item => item.orderItem.title).join("، ") || "غير متاحة"}</p><Link href={`/dashboard/orders?q=${encodeURIComponent(expense.return.order.orderNumber ?? "")}`} className="inline-block font-semibold text-[#4f4a8a] underline">عرض الطلب ←</Link></> : <p className="break-words">{expense.description || "لا يوجد وصف إضافي"}</p>}</div>
      </details>)}</div>
      {!visibleExpenses.length && <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">{selectedCategory ? "لا توجد مصروفات في هذه الفئة." : "لا توجد مصروفات مسجلة بعد."}</p>}
    </section>
  </main>;
}
