import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { listExpenses } from "@/services/finance.service";
import { ExpenseForms } from "@/components/finance/ExpenseForms";
export default async function ExpensesPage() {
  const session = await requireAuth();
  if (!can(session.role, "expenses.read")) throw new Error("Forbidden");
  const store = await db.store.findUnique({ where: { id: session.storeId } });
  const [expenses, categories, materials] = store ? await Promise.all([listExpenses(store.id), db.expenseCategory.findMany({ where: { storeId: store.id, active: true }, orderBy: { name: "asc" } }), db.material.findMany({ where: { storeId: store.id, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })]) : [[], [], []];
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-9"><header><p className="text-sm font-semibold text-[#96723c]">المالية والمخزون</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">المصروفات</h1><p className="mt-2 text-sm text-slate-500">تابع مصروفات المتجر وسجّل مشتريات المواد الخام.</p></header>{can(session.role, "expenses.write") && can(session.role, "inventory.write") && <ExpenseForms categories={categories} materials={materials} />}<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="mb-4 text-lg font-semibold">سجل المصروفات</h2>{expenses.map(e => <div key={e.id} className="flex flex-col gap-2 border-t border-slate-100 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"><div><strong className="block text-slate-900">{e.category.name}</strong>{e.description && <span className="mt-1 block text-slate-500">{e.description}</span>}</div><div className="flex items-center justify-between gap-5 sm:text-left"><strong className="text-slate-900">{Number(e.amount).toLocaleString("ar-EG")} {e.currency}</strong><span className="text-slate-500">{e.date.toLocaleDateString("ar-EG")}</span></div></div>)}{!expenses.length && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">لا توجد مصروفات مسجلة بعد.</p>}</section></main>;
}
