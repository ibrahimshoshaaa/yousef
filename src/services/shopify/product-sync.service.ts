import { db } from "@/lib/db";
import type { ShopifyProductNode } from "@/lib/shopify/types";
import { getClientForStore } from "@/services/shopify/connection.service";

/**
 * Products/variants are Shopify-owned data (spec §9) — we keep a local
 * reference row per spec §10 so recipes and orders can join to them. The
 * `shopifyId` unique-per-store constraint on Product/ProductVariant makes
 * this upsert idempotent whether it runs from the initial sync or a
 * products/update webhook.
 */
export async function upsertShopifyProduct(storeId: string, node: ShopifyProductNode) {
  return db.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { storeId_shopifyId: { storeId, shopifyId: node.id } } });
    const local = !existing && node.handle?.startsWith("erp-")
      ? await tx.product.findFirst({ where: { storeId, handle: node.handle, shopifyId: null } })
      : null;
    const details = { title: node.title, handle: node.handle, status: node.status };
    const product = local
      ? await tx.product.update({ where: { id: local.id }, data: { ...details, shopifyId: node.id } })
      : await tx.product.upsert({
        where: { storeId_shopifyId: { storeId, shopifyId: node.id } },
        update: { ...details, ...(existing?.status === "ARCHIVED" ? { status: "ARCHIVED" } : {}) },
        create: {
          storeId,
          shopifyId: node.id,
          ...details,
        },
      });

    for (const edge of node.variants.edges) {
      const v = edge.node;
      const existingVariant = await tx.productVariant.findUnique({ where: { storeId_shopifyId: { storeId, shopifyId: v.id } } });
      const localVariant = !existingVariant && product.handle?.startsWith("erp-") && node.variants.edges.length === 1
        ? await tx.productVariant.findFirst({ where: { storeId, productId: product.id, shopifyId: null } })
        : null;
      const variantDetails = {
          productId: product.id,
          title: v.title === "Default Title" && product.handle?.startsWith("erp-") ? product.title : v.title,
          sku: v.sku,
          price: v.price,
      };
      if (localVariant) {
        await tx.productVariant.update({ where: { id: localVariant.id }, data: { ...variantDetails, shopifyId: v.id } });
      } else {
        await tx.productVariant.upsert({
          where: { storeId_shopifyId: { storeId, shopifyId: v.id } },
          update: variantDetails,
          create: {
            storeId,
            shopifyId: v.id,
            ...variantDetails,
          },
        });
      }
    }

    return product;
  });
}

export async function syncAllProducts(storeId: string): Promise<{ count: number }> {
  const client = await getClientForStore(storeId);
  let after: string | null = null;
  let count = 0;
  const seen = new Set<string>();

  do {
    const page = await client.fetchProductsPage(50, after);
    for (const node of page.nodes) {
      await upsertShopifyProduct(storeId, node);
      seen.add(node.id);
      count++;
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);

  // Reconcile deletions only after every page has been fetched successfully.
  // Never remove order items or recipe versions used by past sales.
  const linked = await db.product.findMany({
    where: { storeId, shopifyId: { not: null }, NOT: { status: "ARCHIVED" } },
    select: { id: true, shopifyId: true },
  });
  const missing = linked.filter(product => product.shopifyId && !seen.has(product.shopifyId));
  if (missing.length) await db.product.updateMany({
    where: { storeId, id: { in: missing.map(product => product.id) } },
    data: { status: "ARCHIVED" },
  });

  return { count };
}
