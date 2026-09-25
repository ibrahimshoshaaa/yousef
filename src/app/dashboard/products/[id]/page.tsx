import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProduct } from "@/services/product.service";
import { AddVariantForm } from "@/components/products/AddVariantForm";

async function getDevStoreId() {
  const session = await requireAuth();
  if (!can(session.role, "products.read")) throw new Error("Forbidden");
  return session.storeId;
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await getDevStoreId();
  if (!storeId) notFound();

  const product = await getProduct(storeId, id);
  if (!product) notFound();

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <Link
          href="/dashboard/products"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← المنتجات
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-2xl font-bold">{product.title}</h1>
          {!product.shopifyId && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              منتج يدوي
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">المتغيرات (الأحجام)</h2>
            <AddVariantForm productId={product.id} />
          </div>

          {product.variants.length === 0 ? (
            <p className="text-sm text-gray-400">لا توجد متغيرات بعد</p>
          ) : (
            <div className="space-y-3">
              {product.variants.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg border border-[var(--border)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{v.title}</div>
                      <div className="text-xs text-gray-500">
                        {v.sku ? `SKU: ${v.sku} · ` : ""}
                        {Number(v.price).toFixed(2)} EGP
                      </div>
                    </div>

                    {v.currentRecipe ? (
                      <Link
                        href={`/dashboard/recipes/${v.currentRecipe.id}`}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-gray-600 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        وصفة: {v.currentRecipe.name}
                      </Link>
                    ) : (
                      <Link
                        href={`/dashboard/recipes/new?variantId=${v.id}`}
                        className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                      >
                        + إنشاء وصفة
                      </Link>
                    )}
                  </div>

                  {v.costing && (
                    <div className="mt-3 flex gap-6 border-t border-[var(--border)] pt-3 text-sm">
                      <div>
                        <span className="text-gray-500">التكلفة التقديرية: </span>
                        <span className="font-mono font-semibold">
                          {v.costing.estimatedCost.toFixed(2)} EGP
                        </span>
                        {!v.costing.complete && (
                          <span className="mr-1 text-xs text-amber-600">(غير مكتملة)</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-500">الهامش التقديري: </span>
                        <span className="font-mono font-semibold">
                          {v.costing.estimatedMargin.toFixed(2)} EGP
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
