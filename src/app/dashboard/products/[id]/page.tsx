import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProduct } from "@/services/product.service";
import { AddVariantForm } from "@/components/products/AddVariantForm";
import { PublishShopifyButton } from "@/components/products/PublishShopifyButton";
import { db } from "@/lib/db";
import { ArchiveProductButton } from "@/components/products/ArchiveProductButton";

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
  const connection = await db.shopifyConnection.findUnique({ where: { storeId } });
  const canPublish = connection?.status === "CONNECTED" && Boolean(connection.scope?.split(",").map(scope => scope.trim()).includes("write_products"));
  const session = await requireAuth();

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-8 sm:py-9">
      <div className="mb-6">
        <Link
          href="/dashboard/products"
          className="text-sm font-semibold text-[#514b8c] hover:underline"
        >
          ← المنتجات
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-3xl font-bold text-[#191735]">{product.title}</h1>
          {!product.shopifyId && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              منتج يدوي
            </span>
          )}
        </div>
        {can(session.role, "products.write") && <div className="mt-4"><ArchiveProductButton productId={product.id} published={Boolean(product.shopifyId)} /></div>}
      </div>

      <div className="space-y-4">
        {!product.shopifyId && connection?.status === "CONNECTED" && <div className="rounded-2xl border border-[#e5e4ec] bg-white p-5 shadow-sm">
          <h2 className="font-semibold">الظهور في Shopify</h2>
          <p className="mt-1 text-sm text-slate-600">المنتج محفوظ داخل التطبيق فقط. نشره في Shopify يتطلب صلاحية كتابة المنتجات، وبعد النشر تظل الوصفة والخامات مرتبطة بنفس المنتج.</p>
          <div className="mt-3">{canPublish && can(session.role, "shopify.write") && product.variants.length === 1 ? <PublishShopifyButton productId={product.id} /> : <p className="text-sm text-amber-800">{!canPublish ? "فعّل write_products في إعدادات تطبيق Shopify وحدّث SHOPIFY_SCOPES على Vercel ثم أعد ربط المتجر." : "النشر من هنا متاح للمنتجات ذات الحجم الواحد ومن حساب المالك."}</p>}</div>
        </div>}
        <div className="rounded-2xl border border-[#e5e4ec] bg-white p-5 shadow-sm sm:p-6">
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
                  className="rounded-2xl border border-[#e5e4ec] p-4"
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
    </main>
  );
}
