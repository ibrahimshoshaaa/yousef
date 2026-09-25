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
    const product = await tx.product.upsert({
      where: { storeId_shopifyId: { storeId, shopifyId: node.id } },
      update: {
        title: node.title,
        handle: node.handle,
        status: node.status,
      },
      create: {
        storeId,
        shopifyId: node.id,
        title: node.title,
        handle: node.handle,
        status: node.status,
      },
    });

    for (const edge of node.variants.edges) {
      const v = edge.node;
      await tx.productVariant.upsert({
        where: { storeId_shopifyId: { storeId, shopifyId: v.id } },
        update: {
          productId: product.id,
          title: v.title,
          sku: v.sku,
          price: v.price,
        },
        create: {
          storeId,
          productId: product.id,
          shopifyId: v.id,
          title: v.title,
          sku: v.sku,
          price: v.price,
        },
      });
    }

    return product;
  });
}

export async function syncAllProducts(storeId: string): Promise<{ count: number }> {
  const client = await getClientForStore(storeId);
  let after: string | null = null;
  let count = 0;

  do {
    const page = await client.fetchProductsPage(50, after);
    for (const node of page.nodes) {
      await upsertShopifyProduct(storeId, node);
      count++;
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);

  return { count };
}
