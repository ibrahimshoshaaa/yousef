import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { listExpenses } from "@/services/finance.service";
import { ExpenseForms } from "@/components/finance/ExpenseForms";

export default async function ExpensesPage() {
  const session = await requireAuth();
  if (!can(session.role, "expenses.read")) throw new Error("Forbidden");
  const store = await db.store.findUnique({ where: { id: session.storeId } });
  const [expenses, categories] = store ? await Promise.all([
    listExpenses(store.id),
    db.expenseCategory.findMany({ where: { storeId: store.id, active: true }, orderBy: { name: "asc" } }),
  ]) : [[], []];

  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-9">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold text-[#96723c]">المالية والمخزون</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">المصروفات</h1><p className="mt-2 text-sm text-slate-500">تابع مصروفات المتجر ومشتريات الخامات المسجلة تلقائيًا عند إضافة المخزون.</p></div>
      {can(session.role, "expenses.write") && <ExpenseForms categories={categories} currency={store?.currency ?? "EGP"} />}
    </header>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">سجل المصروفات</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{expenses.length} مصروف</span></div>
      <div className="space-y-3">{expenses.map((expense) => <article key={expense.id} className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><strong className="text-sm text-slate-900">{expense.category.name}</strong>{expense.description && <p className="mt-1 break-words text-sm text-slate-600">{expense.description}</p>}<time className="mt-2 block text-xs text-slate-500" dateTime={expense.date.toISOString()}>{expense.date.toLocaleDateString("ar-EG")}</time></div>
        <strong className="shrink-0 text-base text-[#263b35]">{Number(expense.amount).toLocaleString("ar-EG")} {expense.currency}</strong>
      </article>)}</div>
      {!expenses.length && <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">لا توجد مصروفات مسجلة بعد.</p>}
    </section>
  </main>;
}
