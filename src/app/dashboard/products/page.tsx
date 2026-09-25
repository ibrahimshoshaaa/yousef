import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { Suspense } from "react";
import Link from "next/link";
import { listProducts } from "@/services/product.service";

async function getDevStoreId() {
  const session = await requireAuth();
  if (!can(session.role, "products.read")) throw new Error("Forbidden");
  return session.storeId;
}

async function ProductsTable({ storeId }: { storeId: string }) {
  const products = await listProducts(storeId);

  if (products.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-gray-400">
        لا توجد منتجات بعد — أضف منتجًا يدويًا أو اربط Shopify
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {products.map((p) => (
        <div
          key={p.id}
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-white"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{p.title}</span>
              {!p.shopifyId && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                  يدوي
                </span>
              )}
            </div>
            <Link
              href={`/dashboard/products/${p.id}`}
              className="text-xs text-blue-600 hover:underline"
            >
              تفاصيل
            </Link>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-right text-xs text-gray-500">
                <th className="px-4 py-2">المتغير</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2 text-center">السعر</th>
                <th className="px-4 py-2">الوصفة</th>
                <th className="px-4 py-2 text-center">التكلفة التقديرية</th>
                <th className="px-4 py-2 text-center">الهامش التقديري</th>
              </tr>
            </thead>
            <tbody>
              {p.variants.map((v) => (
                <tr key={v.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2 font-medium">{v.title}</td>
                  <td className="px-4 py-2 text-gray-500">{v.sku ?? "—"}</td>
                  <td className="px-4 py-2 text-center font-mono">
                    {Number(v.price).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    {v.currentRecipe ? (
                      <span className="text-gray-700">{v.currentRecipe.name}</span>
                    ) : (
                      <Link
                        href={`/dashboard/recipes/new?variantId=${v.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        + إنشاء وصفة
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center font-mono">
                    {v.costing
                      ? `${v.costing.estimatedCost.toFixed(2)}${
                          v.costing.complete ? "" : "*"
                        }`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-center font-mono">
                    {v.costing ? v.costing.estimatedMargin.toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
              {p.variants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-xs text-gray-400">
                    لا توجد متغيرات (أحجام) بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-xs text-gray-400">
        * التكلفة تقديرية وغير مكتملة — بعض المواد في الوصفة بدون تكلفة افتراضية
      </p>
    </div>
  );
}

export default async function ProductsPage() {
  const storeId = await getDevStoreId();

  return (
    <div className="p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">المبيعات</p>
          <h1 className="mt-1 text-2xl font-bold">المنتجات</h1>
        </div>
        <Link
          href="/dashboard/products/new"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + إضافة منتج يدويًا
        </Link>
      </header>

      {storeId ? (
        <Suspense
          fallback={<div className="h-48 animate-pulse rounded-xl bg-gray-100" />}
        >
          <ProductsTable storeId={storeId} />
        </Suspense>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-gray-400">
          لم يتم إنشاء متجر بعد
        </div>
      )}
    </div>
  );
}
