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
  return <main className="space-y-6 p-4 md:p-8"><h1 className="text-2xl font-bold">المصروفات</h1>{can(session.role, "expenses.write") && can(session.role, "inventory.write") && <ExpenseForms categories={categories} materials={materials} />}<section className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold">سجل المصروفات</h2>{expenses.map(e => <div key={e.id} className="flex flex-wrap justify-between gap-2 border-t py-3 text-sm"><span>{e.category.name} · {e.description ?? ""}</span><span>{Number(e.amount)} {e.currency}</span><span>{e.date.toLocaleDateString("ar-EG")}</span></div>)}{!expenses.length && <p className="text-gray-500">لا توجد مصروفات بعد.</p>}</section></main>;
}
