import Link from "next/link";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

export default async function ProductsPage() {
  const session = await requireAuth();
  if (!can(session.role, "products.read")) throw new Error("Forbidden");
  const products = await db.product.findMany({
    where: { storeId: session.storeId, NOT: { status: "ARCHIVED" } },
    include: { variants: { where: { active: true }, include: { recipes: { include: { versions: { where: { isCurrent: true }, include: { items: { include: { material: { select: { name: true, unit: true } } } } } } } } } } },
    orderBy: { title: "asc" },
  });
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-9">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-[#96723c]">العطور وخاماتها</p><h1 className="mt-1 text-3xl font-bold">المنتجات</h1><p className="mt-2 text-sm text-slate-500">كل عطر تحدد خاماته مرة، وهي تتخصم من المخزون عند البيع.</p></div>{can(session.role, "products.write") && <Link href="/dashboard/products/new" className="rounded-xl bg-[#191735] px-5 py-3 text-sm font-semibold text-white">+ إضافة عطر وخاماته</Link>}</header>
    {!products.length && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">لا توجد عطور بعد. ابدأ بإضافة عطر واختر خاماته من المخزون.</p>}
    <div className="grid gap-3 sm:grid-cols-2">{products.map(product => <Link key={product.id} href={`/dashboard/products/${product.id}`} className="flex min-h-24 items-center justify-between gap-3 rounded-2xl border border-[#e5e4ec] bg-white p-5 shadow-sm transition hover:border-[#aaa5cf]">
      <div className="min-w-0"><h2 className="truncate text-lg font-bold text-[#191735]">{product.title}</h2><p className="mt-1 text-sm text-slate-500">{product.variants.length} {product.variants.length === 1 ? "حجم" : "أحجام"} · {product.shopifyId ? "مرتبط بـ Shopify" : "منتج محلي"}</p><p className="mt-1 text-xs text-slate-500">{product.variants.filter(variant => variant.recipes[0]?.versions[0]?.items.length).length} وصفة مسجلة</p></div><span aria-hidden="true" className="text-2xl text-[#625f89]">←</span>
    </Link>)}</div>
  </main>;
}
