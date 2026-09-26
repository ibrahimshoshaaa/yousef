import Link from "next/link";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { QuickStockForm } from "@/components/inventory/QuickStockForm";

const categories = [
  { key: "OILS", name: "زيوت", aliases: ["زيت", "زيوت"] },
  { key: "BOTTLES", name: "زجاجات", aliases: ["زجاجة", "زجاجات"] },
  { key: "BOXES", name: "بوكسات التغليف", aliases: ["بوكس", "بوكسات", "بوكسات التغليف"] },
  { key: "TESTERS", name: "زجاجات تيستر", aliases: ["تيستر", "زجاجات تيستر"] },
];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ add?: string; q?: string }> }) {
  const session = await requireAuth();
  const { add, q } = await searchParams;
  if (!can(session.role, "inventory.read")) throw new Error("Forbidden");
  const [balances, types] = await Promise.all([
    db.inventoryBalance.findMany({ where: { storeId: session.storeId }, include: { material: { include: { materialType: true } } }, orderBy: { material: { name: "asc" } } }),
    db.materialType.findMany({ where: { storeId: session.storeId, active: true }, orderBy: { name: "asc" } }),
  ]);
  const categoryFor = (name: string) => categories.find((entry) => entry.aliases.includes(name));
  const extra = types.filter((type) => !categoryFor(type.name));
  const groups = [...categories.map(({ key, name }) => ({ key, name })), ...extra.map((type) => ({ key: `type:${type.id}`, name: type.name }))];
  const query = (q ?? "").trim().slice(0, 100);
  const visible = query ? balances.filter((balance) => balance.material.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())) : balances;
  const lowCount = balances.filter((balance) => balance.material.reorderLevel !== null && Number(balance.quantity) < Number(balance.material.reorderLevel)).length;
  const format = (value: number) => value.toLocaleString("ar-EG", { maximumFractionDigits: 3 });

  return <main className="mx-auto max-w-6xl space-y-4 px-4 py-4 sm:space-y-6 sm:px-8 sm:py-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">المخزون</h1><p className="mt-1 text-xs text-slate-500 sm:text-sm">رصيد خامات الشغل حسب النوع</p></div>
      {can(session.role, "inventory.write") && can(session.role, "expenses.write") && can(session.role, "materials.write") && <QuickStockForm initialOpen={add === "1"} extraCategories={extra.map((type) => ({ id: `type:${type.id}`, name: type.name }))} />}
    </header>
    <section aria-label="ملخص المخزون" className="grid grid-cols-2 gap-2 sm:gap-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4"><p className="text-xs text-slate-500">الخامات المسجلة</p><strong className="mt-1 block text-xl text-[#263b35]">{format(balances.length)}</strong></div>
      <div className={`rounded-xl border p-3 sm:p-4 ${lowCount ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}><p className="text-xs text-slate-500">تحتاج إعادة شراء</p><strong className={`mt-1 block text-xl ${lowCount ? "text-amber-900" : "text-[#263b35]"}`}>{format(lowCount)}</strong></div>
    </section>
    <form action="/dashboard/inventory" method="get" className="flex gap-2"><input name="q" defaultValue={query} maxLength={100} aria-label="ابحث عن خامة" placeholder="ابحث عن خامة..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#315b4c]" /><button className="rounded-xl bg-[#263b35] px-4 py-2.5 text-sm font-semibold text-white">بحث</button>{query && <Link href="/dashboard/inventory" className="self-center px-1 text-sm text-[#315b4c] underline">مسح</Link>}</form>
    <div className="grid gap-3 sm:grid-cols-2">{groups.map((group) => {
      const rows = visible.filter((balance) => (categoryFor(balance.material.materialType.name)?.key ?? `type:${balance.material.materialTypeId}`) === group.key);
      if (query && !rows.length) return null;
      return <section key={group.key} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="font-bold text-slate-900">{group.name}</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{format(rows.length)} خامة</span></div>
        <div className="divide-y divide-slate-100 px-4">{rows.map((balance) => {
          const low = balance.material.reorderLevel !== null && Number(balance.quantity) < Number(balance.material.reorderLevel);
          return <Link key={balance.id} href={`/dashboard/materials/${balance.materialId}`} aria-label={`تفاصيل ${balance.material.name} وحركة المخزون`} className="group flex min-w-0 items-center justify-between gap-2 py-3 text-sm hover:text-[#315b4c]"><span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span className="min-w-0 break-words font-medium">{balance.material.name}</span><span className="shrink-0 text-xs font-semibold text-[#315b4c] group-hover:underline">التفاصيل ←</span></span><span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold sm:text-sm ${low ? "bg-amber-50 text-amber-900" : "bg-[#f1f5f2] text-[#263b35]"}`}>{format(Number(balance.quantity))} {balance.material.unit}</span></Link>;
        })}{!rows.length && <p className="py-4 text-sm text-slate-400">لم تضف خامات لهذا النوع بعد.</p>}</div>
      </section>;
    })}</div>
    {query && !visible.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">لا توجد خامة بهذا الاسم.</p>}
  </main>;
}
