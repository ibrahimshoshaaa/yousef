import Link from "next/link";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

export default async function ProductsPage() {
  const session = await requireAuth();
  if (!can(session.role, "products.read")) throw new Error("Forbidden");
  const products = await db.product.findMany({
    where: { storeId: session.storeId },
    include: { variants: { where: { active: true }, include: { recipes: { include: { versions: { where: { isCurrent: true }, include: { items: { include: { material: { select: { name: true, unit: true } } } } } } } } } } },
    orderBy: { title: "asc" },
  });
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-9">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-[#96723c]">العطور وخاماتها</p><h1 className="mt-1 text-3xl font-bold">المنتجات</h1><p className="mt-2 text-sm text-slate-500">كل عطر تحدد خاماته مرة، وهي تتخصم من المخزون عند البيع.</p></div>{can(session.role, "products.write") && <Link href="/dashboard/products/new" className="rounded-xl bg-[#263b35] px-5 py-3 text-sm font-semibold text-white">+ إضافة عطر وخاماته</Link>}</header>
    {!products.length && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">لا توجد عطور بعد. ابدأ بإضافة عطر واختر خاماته من المخزون.</p>}
    <div className="grid gap-4 sm:grid-cols-2">{products.flatMap((product) => product.variants.map((variant) => {
      const items = variant.recipes[0]?.versions[0]?.items ?? [];
      return <article key={variant.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{product.title}{product.title !== variant.title && <span className="text-sm font-normal text-slate-500"> · {variant.title}</span>}</h2><p className="mt-1 text-sm text-slate-500">سعر البيع: {Number(variant.price).toLocaleString("ar-EG")} جنيه</p></div><Link href={`/dashboard/products/${product.id}`} className="text-sm font-semibold text-[#315b4c] underline">تفاصيل</Link></div><div className="mt-4 border-t border-slate-100 pt-4"><p className="mb-2 text-sm font-semibold">خامات العطر الواحد</p>{items.length ? <div className="flex flex-wrap gap-2">{items.map((item) => <span key={item.id} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs">{item.material.name}: {Number(item.quantity)} {item.material.unit}</span>)}</div> : <p className="text-sm text-amber-700">لم تحدد خامات هذا المنتج بعد. <Link href={`/dashboard/recipes/new?variantId=${variant.id}`} className="font-semibold underline">إضافة الخامات</Link></p>}</div></article>;
    }))}</div>
  </main>;
}
