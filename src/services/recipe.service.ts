import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecipeItemInput = {
  materialId: string;
  quantity: number;
  unit: string;
};

export type RecipeCreateInput = {
  storeId: string;
  variantId: string;
  name: string;
  items: RecipeItemInput[];
  userId?: string | null;
};

const recipeInclude = {
  variant: { include: { product: true } },
  versions: {
    orderBy: { version: "desc" as const },
    include: { items: { include: { material: true } } },
  },
} satisfies Prisma.RecipeInclude;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listRecipes(
  storeId: string,
  opts: { search?: string; variantId?: string } = {}
) {
  const where: Prisma.RecipeWhereInput = {
    storeId,
    ...(opts.variantId ? { variantId: opts.variantId } : {}),
    ...(opts.search
      ? {
          OR: [
            { name: { contains: opts.search, mode: "insensitive" } },
            {
              variant: {
                is: { title: { contains: opts.search, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
  };

  return db.recipe.findMany({
    where,
    include: recipeInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getRecipe(storeId: string, recipeId: string) {
  return db.recipe.findFirst({
    where: { id: recipeId, storeId },
    include: recipeInclude,
  });
}

export function currentVersionOf(
  recipe: Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>
) {
  return (
    recipe.versions.find((v) => v.isCurrent) ?? recipe.versions[0] ?? null
  );
}

/**
 * Estimated cost of one unit of a recipe version, using each material's
 * `defaultCost` (the DEFAULT_COST costing method — see src/lib/settings.ts;
 * weighted-average / per-order cost snapshots are documented as future
 * enhancements, not implemented in this chunk).
 * `complete` is false when a component material has no defaultCost set,
 * so the UI can label the total as partial/incomplete.
 */
export async function getRecipeVersionCost(storeId: string, versionId: string) {
  const version = await db.recipeVersion.findFirst({
    where: { id: versionId, storeId },
    include: { items: { include: { material: true } } },
  });
  if (!version) throw new Error("Recipe version not found");

  let total = 0;
  let complete = true;
  const breakdown = version.items.map((item) => {
    const unitCost = item.material.defaultCost;
    if (unitCost === null) complete = false;
    const lineCost = unitCost !== null ? Number(unitCost) * Number(item.quantity) : 0;
    total += lineCost;
    return {
      materialId: item.materialId,
      materialName: item.material.name,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitCost: unitCost !== null ? Number(unitCost) : null,
      lineCost,
    };
  });

  return { total, complete, breakdown };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createRecipe(data: RecipeCreateInput) {
  if (data.items.length === 0) {
    throw new Error("Recipe must contain at least one material");
  }

  const variant = await db.productVariant.findFirst({
    where: { id: data.variantId, storeId: data.storeId },
  });
  if (!variant) throw new Error("Variant not found");

  const existing = await db.recipe.findUnique({
    where: { storeId_variantId: { storeId: data.storeId, variantId: data.variantId } },
  });
  if (existing) throw new Error("Variant already has a recipe");

  return db.$transaction(async (tx) => {
    const recipe = await tx.recipe.create({
      data: {
        storeId: data.storeId,
        variantId: data.variantId,
        name: data.name,
      },
    });

    const version = await tx.recipeVersion.create({
      data: {
        storeId: data.storeId,
        recipeId: recipe.id,
        version: 1,
        isCurrent: true,
        items: {
          create: data.items.map((item) => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unit: item.unit,
          })),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        storeId: data.storeId,
        userId: data.userId ?? null,
        action: "CREATE",
        entity: "Recipe",
        entityId: recipe.id,
        after: { recipe, version } as unknown as Prisma.JsonObject,
      },
    });

    return { recipe, version };
  });
}

export type AddVersionInput = {
  storeId: string;
  recipeId: string;
  items: RecipeItemInput[];
  userId?: string | null;
};

/**
 * Adds a new recipe version and makes it current. Past versions are never
 * edited in place — this is what keeps historical orders explainable by
 * the version that was effective for them (spec §22).
 */
export async function addRecipeVersion(data: AddVersionInput) {
  if (data.items.length === 0) {
    throw new Error("Recipe version must contain at least one material");
  }

  const recipe = await db.recipe.findFirst({
    where: { id: data.recipeId, storeId: data.storeId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!recipe) throw new Error("Recipe not found");

  const nextVersionNumber = (recipe.versions[0]?.version ?? 0) + 1;

  return db.$transaction(async (tx) => {
    // Freeze the version being superseded and clear its "current" flag —
    // once a version is no longer current it is considered historical and
    // must not be edited again.
    await tx.recipeVersion.updateMany({
      where: { recipeId: recipe.id },
      data: { isCurrent: false },
    });
    if (recipe.versions[0]) {
      await tx.recipeVersion.update({
        where: { id: recipe.versions[0].id },
        data: { immutable: true },
      });
    }

    const version = await tx.recipeVersion.create({
      data: {
        storeId: data.storeId,
        recipeId: recipe.id,
        version: nextVersionNumber,
        isCurrent: true,
        items: {
          create: data.items.map((item) => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unit: item.unit,
          })),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        storeId: data.storeId,
        userId: data.userId ?? null,
        action: "CREATE_VERSION",
        entity: "Recipe",
        entityId: recipe.id,
        after: version as unknown as Prisma.JsonObject,
      },
    });

    return version;
  });
}

export type ActivateVersionInput = {
  storeId: string;
  recipeId: string;
  versionId: string;
  userId?: string | null;
};

/** Rolls the "current" pointer back to any historical version (spec §45). */
export async function activateRecipeVersion(data: ActivateVersionInput) {
  const version = await db.recipeVersion.findFirst({
    where: { id: data.versionId, recipeId: data.recipeId, storeId: data.storeId },
  });
  if (!version) throw new Error("Recipe version not found");

  return db.$transaction(async (tx) => {
    await tx.recipeVersion.updateMany({
      where: { recipeId: data.recipeId },
      data: { isCurrent: false },
    });
    const updated = await tx.recipeVersion.update({
      where: { id: version.id },
      data: { isCurrent: true },
    });

    await tx.auditLog.create({
      data: {
        storeId: data.storeId,
        userId: data.userId ?? null,
        action: "ACTIVATE_VERSION",
        entity: "Recipe",
        entityId: data.recipeId,
        after: { activeVersionId: version.id, version: version.version } as unknown as Prisma.JsonObject,
      },
    });

    return updated;
  });
}
