import { db } from "@/lib/db";
import { getClientForStore } from "@/services/shopify/connection.service";
import { upsertShopifyProduct } from "@/services/shopify/product-sync.service";

export async function publishProductToShopify(storeId: string, productId: string) {
  const [product, connection] = await Promise.all([
    db.product.findFirst({ where: { id: productId, storeId }, include: { variants: true } }),
    db.shopifyConnection.findUnique({ where: { storeId } }),
  ]);
  if (!product) throw new Error("المنتج غير موجود");
  if (product.shopifyId) return product;
  if (product.variants.length !== 1) throw new Error("النشر المباشر متاح للعطور ذات الحجم الواحد فقط");
  if (connection?.status !== "CONNECTED") throw new Error("اربط متجر Shopify أولًا");
  if (!connection.scope?.split(",").map(scope => scope.trim()).includes("write_products")) {
    throw new Error("صلاحية write_products غير مفعلة؛ حدّث صلاحيات تطبيق Shopify وأعد ربط المتجر");
  }

  // Save before calling Shopify so its products/create webhook can attach to
  // the existing product and recipe even if it arrives before this request ends.
  const handle = product.handle?.startsWith("erp-") ? product.handle : `erp-${product.id.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
  if (product.handle !== handle) await db.product.update({ where: { id: product.id }, data: { handle } });

  const client = await getClientForStore(storeId);
  const shopifyId = await client.publishSingleVariantProduct({
    handle, title: product.title, price: product.variants[0].price.toString(),
  });
  const remote = await client.fetchProductById(shopifyId);
  if (!remote) throw new Error("أُنشئ المنتج في Shopify؛ أعد المحاولة لربطه داخل التطبيق");
  return upsertShopifyProduct(storeId, remote);
}
