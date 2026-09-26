import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { listExpenses } from "@/services/finance.service";
import { ExpenseForms } from "@/components/finance/ExpenseForms";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const session = await requireAuth();
  if (!can(session.role, "expenses.read")) throw new Error("Forbidden");
  const store = await db.store.findUnique({ where: { id: session.storeId } });
  const [expenses, categories] = store ? await Promise.all([
    listExpenses(store.id),
    db.expenseCategory.findMany({ where: { storeId: store.id, active: true }, orderBy: { name: "asc" } }),
  ]) : [[], []];
  const { category: requestedCategory } = await searchParams;
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
      {can(session.role, "expenses.write") && <ExpenseForms categories={categories} currency={currency} />}
    </header>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm text-slate-500">إجمالي المصروفات</p><p className="mt-1 text-2xl font-bold text-[#263b35]">{formatAmount(total)}</p></div>
        <form action="/dashboard/expenses" method="get" className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium text-slate-700">تصفية حسب الفئة<select name="category" defaultValue={selectedCategory} className="mt-2 block min-w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#96723c]"><option value="">كل الفئات</option>{filterCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <button type="submit" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">تطبيق</button>
        </form>
      </div>
      <div className="my-5 border-t border-slate-100" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">سجل المصروفات</h2><div className="flex flex-wrap items-center gap-2">{selectedCategory && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-[#96723c]">إجمالي الفئة: {formatAmount(filteredTotal)}</span>}<span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{visibleExpenses.length} مصروف</span></div></div>
      <div className="space-y-3">{visibleExpenses.map((expense) => <article key={expense.id} className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><strong className="text-sm text-slate-900">{expense.category.name}</strong>{expense.description && <p className="mt-1 break-words text-sm text-slate-600">{expense.description}</p>}<time className="mt-2 block text-xs text-slate-500" dateTime={expense.date.toISOString()}>{expense.date.toLocaleDateString("ar-EG")}</time></div>
        <strong className="shrink-0 text-base text-[#263b35]">{Number(expense.amount).toLocaleString("ar-EG", { maximumFractionDigits: 4 })} {expense.currency}</strong>
      </article>)}</div>
      {!visibleExpenses.length && <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">{selectedCategory ? "لا توجد مصروفات في هذه الفئة." : "لا توجد مصروفات مسجلة بعد."}</p>}
    </section>
  </main>;
}
