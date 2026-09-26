import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { ManualSaleForm } from "@/components/orders/ManualSaleForm";

export default async function NewManualSalePage() {
  const session = await requireAuth();
  if (!can(session.role, "orders.write")) throw new Error("Forbidden");
  const variants = await db.productVariant.findMany({
    where: { storeId: session.storeId, active: true },
    select: { id: true, title: true, price: true, product: { select: { title: true } } },
    orderBy: { product: { title: "asc" } },
  });
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-8 sm:py-9">
    <header><Link href="/dashboard/orders" className="text-sm font-semibold text-[#315b4c] hover:underline">← الطلبات</Link><h1 className="mt-3 text-3xl font-bold text-slate-900">إضافة طلب</h1><p className="mt-2 text-sm leading-6 text-slate-600">سجّل المنتجات وبيانات العميل والديبوزت، ثم تابع التجهيز والشحن والتسليم من صفحة الطلبات.</p></header>
    <ManualSaleForm variants={variants.map((variant) => ({ id: variant.id, label: `${variant.product.title} · ${variant.title}`, price: Number(variant.price) }))} />
  </main>;
}
