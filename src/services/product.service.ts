import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getRecipeVersionCost } from "@/services/recipe.service";
import { isCostingEnabled } from "@/lib/settings";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductCreateInput = {
  storeId: string;
  title: string;
  handle?: string | null;
};

export type VariantCreateInput = {
  storeId: string;
  productId: string;
  title: string;
  sku?: string | null;
  price: number;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

const variantInclude = {
  recipes: {
    include: {
      versions: {
        where: { isCurrent: true },
        include: { items: { include: { material: true } } },
      },
    },
  },
} satisfies Prisma.ProductVariantInclude;

export async function listProducts(
  storeId: string,
  opts: { search?: string } = {}
) {
  const where: Prisma.ProductWhereInput = {
    storeId,
    ...(opts.search
      ? {
          OR: [
            { title: { contains: opts.search, mode: "insensitive" } },
            {
              variants: {
                some: { sku: { contains: opts.search, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
  };

  const products = await db.product.findMany({
    where,
    include: { variants: { include: variantInclude, orderBy: { title: "asc" } } },
    orderBy: { title: "asc" },
  });

  const costingEnabled = await isCostingEnabled(storeId);

  return Promise.all(
    products.map(async (p) => ({
      ...p,
      variants: await Promise.all(
        p.variants.map((v) => attachVariantCosting(v, costingEnabled))
      ),
    }))
  );
}

export async function getProduct(storeId: string, productId: string) {
  const product = await db.product.findFirst({
    where: { id: productId, storeId },
    include: { variants: { include: variantInclude, orderBy: { title: "asc" } } },
  });
  if (!product) return null;

  const costingEnabled = await isCostingEnabled(storeId);
  const variants = await Promise.all(
    product.variants.map((v) => attachVariantCosting(v, costingEnabled))
  );

  return { ...product, variants };
}

export async function getVariant(storeId: string, variantId: string) {
  const variant = await db.productVariant.findFirst({
    where: { id: variantId, storeId },
    include: {
      product: true,
      ...variantInclude,
    },
  });
  if (!variant) return null;

  const costingEnabled = await isCostingEnabled(storeId);
  const withCosting = await attachVariantCosting(variant, costingEnabled);

  const [unitsSold, returnCount] = await Promise.all([
    db.orderItem.aggregate({
      where: { variantId },
      _sum: { quantity: true },
    }),
    db.returnItem.count({
      where: { orderItem: { variantId } },
    }),
  ]);

  return {
    ...withCosting,
    unitsSold: Number(unitsSold._sum.quantity ?? 0),
    returnCount,
  };
}

/** Variants with no recipe mapped yet — used to build the "create recipe" picker. */
export async function listUnmappedVariants(storeId: string) {
  return db.productVariant.findMany({
    where: { storeId, active: true, recipes: { none: {} } },
    include: { product: true },
    orderBy: [{ product: { title: "asc" } }, { title: "asc" }],
  });
}

async function attachVariantCosting(
  variant: Prisma.ProductVariantGetPayload<{ include: typeof variantInclude }>,
  costingEnabled: boolean
) {
  const recipe = variant.recipes[0] ?? null;
  const currentVersion = recipe?.versions[0] ?? null;

  if (!costingEnabled || !currentVersion) {
    return {
      ...variant,
      currentRecipe: recipe
        ? { id: recipe.id, name: recipe.name, versionId: currentVersion?.id ?? null }
        : null,
      costing: null as null | {
        estimatedCost: number;
        estimatedMargin: number;
        complete: boolean;
      },
    };
  }

  const cost = await getRecipeVersionCost(variant.storeId, currentVersion.id);
  return {
    ...variant,
    currentRecipe: { id: recipe!.id, name: recipe!.name, versionId: currentVersion.id },
    costing: {
      estimatedCost: cost.total,
      estimatedMargin: Number(variant.price) - cost.total,
      complete: cost.complete,
    },
  };
}

// ─── Mutations (manual entry — fallback until Shopify sync ships in Chunk 4) ──

export async function createProduct(data: ProductCreateInput) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        storeId: data.storeId,
        title: data.title,
        handle: data.handle ?? null,
        status: "ACTIVE",
      },
    });

    await tx.auditLog.create({
      data: {
        storeId: data.storeId,
        action: "CREATE",
        entity: "Product",
        entityId: product.id,
        after: product as unknown as Prisma.JsonObject,
        metadata: { source: "manual" },
      },
    });

    return product;
  });
}

export async function createVariant(data: VariantCreateInput) {
  const product = await db.product.findFirst({
    where: { id: data.productId, storeId: data.storeId },
  });
  if (!product) throw new Error("Product not found");

  return db.$transaction(async (tx) => {
    const variant = await tx.productVariant.create({
      data: {
        storeId: data.storeId,
        productId: data.productId,
        title: data.title,
        sku: data.sku ?? null,
        price: data.price,
      },
    });

    await tx.auditLog.create({
      data: {
        storeId: data.storeId,
        action: "CREATE",
        entity: "ProductVariant",
        entityId: variant.id,
        after: variant as unknown as Prisma.JsonObject,
        metadata: { source: "manual" },
      },
    });

    return variant;
  });
}
