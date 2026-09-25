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

export default async function InventoryPage() {
  const session = await requireAuth();
  if (!can(session.role, "inventory.read")) throw new Error("Forbidden");
  const [balances, types] = await Promise.all([
    db.inventoryBalance.findMany({ where: { storeId: session.storeId }, include: { material: { include: { materialType: true } } }, orderBy: { material: { name: "asc" } } }),
    db.materialType.findMany({ where: { storeId: session.storeId, active: true }, orderBy: { name: "asc" } }),
  ]);
  const categoryFor = (name: string) => categories.find((entry) => entry.aliases.includes(name));
  const extra = types.filter((type) => !categoryFor(type.name));
  const groups = [...categories.map(({ key, name }) => ({ key, name })), ...extra.map((type) => ({ key: `type:${type.id}`, name: type.name }))];
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-9">
    <header><p className="text-sm font-semibold text-[#96723c]">خامات الشغل</p><h1 className="mt-1 text-3xl font-bold">المخزون</h1><p className="mt-2 text-sm text-slate-500">أضف زيت أو زجاجة أو بوكس أو تيستر بالكمية وسعر الشراء، وتابع المتبقي هنا.</p></header>
    {can(session.role, "inventory.write") && can(session.role, "expenses.write") && can(session.role, "materials.write") && <QuickStockForm extraCategories={extra.map((type) => ({ id: `type:${type.id}`, name: type.name }))} />}
    <div className="grid gap-5 sm:grid-cols-2">{groups.map((group) => {
      const rows = balances.filter((balance) => (categoryFor(balance.material.materialType.name)?.key ?? `type:${balance.material.materialTypeId}`) === group.key);
      return <section key={group.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">{group.name}</h2><p className="mt-1 text-xs text-slate-500">{rows.length} خامة</p><div className="mt-4 divide-y divide-slate-100">{rows.map((balance) => <Link key={balance.id} href={`/dashboard/materials/${balance.materialId}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-[#315b4c]"><span className="font-medium">{balance.material.name}</span><strong className="shrink-0">{Number(balance.quantity).toLocaleString("ar-EG")} {balance.material.unit}</strong></Link>)}{rows.length === 0 && <p className="py-3 text-sm text-slate-400">لم تضف خامات لهذا النوع بعد.</p>}</div></section>;
    })}</div>
  </main>;
}
