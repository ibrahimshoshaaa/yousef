import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MaterialCreateInput = {
  storeId: string;
  materialTypeId: string;
  supplierId?: string | null;
  name: string;
  sku?: string | null;
  unit: string;
  baseUnit: string;
  description?: string | null;
  capacityMl?: number | null;
  defaultCost?: number | null;
  reorderLevel?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type MaterialUpdateInput = Partial<
  Omit<MaterialCreateInput, "storeId"> & { active: boolean }
>;

export type InventoryAdjustmentInput = {
  storeId: string;
  materialId: string;
  quantity: number; // positive = add, negative = subtract
  reason: string;
  note?: string | null;
  userId?: string | null;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listMaterials(
  storeId: string,
  opts: { search?: string; typeId?: string; active?: boolean } = {}
) {
  const where: Prisma.MaterialWhereInput = {
    storeId,
    ...(opts.active !== undefined ? { active: opts.active } : {}),
    ...(opts.typeId ? { materialTypeId: opts.typeId } : {}),
    ...(opts.search
      ? {
          OR: [
            { name: { contains: opts.search, mode: "insensitive" } },
            { sku: { contains: opts.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return db.material.findMany({
    where,
    include: {
      materialType: true,
      supplier: true,
      balance: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getMaterial(storeId: string, materialId: string) {
  return db.material.findFirst({
    where: { id: materialId, storeId },
    include: {
      materialType: true,
      supplier: true,
      balance: true,
    },
  });
}

export async function listMaterialTypes(storeId: string) {
  return db.materialType.findMany({
    where: { storeId, active: true },
    orderBy: { name: "asc" },
  });
}

export async function listSuppliers(storeId: string) {
  return db.supplier.findMany({
    where: { storeId, active: true },
    orderBy: { name: "asc" },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createMaterial(data: MaterialCreateInput) {
  return db.$transaction(async (tx) => {
    const material = await tx.material.create({
      data: {
        storeId: data.storeId,
        materialTypeId: data.materialTypeId,
        supplierId: data.supplierId ?? null,
        name: data.name,
        sku: data.sku ?? null,
        unit: data.unit,
        baseUnit: data.baseUnit,
        description: data.description ?? null,
        capacityMl: data.capacityMl ?? null,
        defaultCost: data.defaultCost ?? null,
        reorderLevel: data.reorderLevel ?? null,
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonObject) : Prisma.JsonNull,
      },
    });

    // Initialise balance at 0
    await tx.inventoryBalance.create({
      data: {
        storeId: data.storeId,
        materialId: material.id,
        quantity: 0,
      },
    });

    await tx.auditLog.create({
      data: {
        storeId: data.storeId,
        action: "CREATE",
        entity: "Material",
        entityId: material.id,
        after: material as unknown as Prisma.JsonObject,
      },
    });

    return material;
  });
}

export async function updateMaterial(
  storeId: string,
  materialId: string,
  data: MaterialUpdateInput,
  userId?: string
) {
  const existing = await db.material.findFirst({
    where: { id: materialId, storeId },
  });
  if (!existing) throw new Error("Material not found");

  return db.$transaction(async (tx) => {
    const updated = await tx.material.update({
      where: { id: materialId },
      data: {
        ...(data.materialTypeId !== undefined
          ? { materialTypeId: data.materialTypeId }
          : {}),
        ...(data.supplierId !== undefined
          ? { supplierId: data.supplierId }
          : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.sku !== undefined ? { sku: data.sku } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(data.baseUnit !== undefined ? { baseUnit: data.baseUnit } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.capacityMl !== undefined
          ? { capacityMl: data.capacityMl }
          : {}),
        ...(data.defaultCost !== undefined
          ? { defaultCost: data.defaultCost }
          : {}),
        ...(data.reorderLevel !== undefined
          ? { reorderLevel: data.reorderLevel }
          : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        storeId,
        userId: userId ?? null,
        action: "UPDATE",
        entity: "Material",
        entityId: materialId,
        before: existing as unknown as Prisma.JsonObject,
        after: updated as unknown as Prisma.JsonObject,
      },
    });

    return updated;
  });
}

// ─── Inventory Adjustment ─────────────────────────────────────────────────────

export async function adjustInventory(input: InventoryAdjustmentInput) {
  const { storeId, materialId, quantity, reason, note, userId } = input;

  const material = await db.material.findFirst({
    where: { id: materialId, storeId },
    include: { balance: true },
  });
  if (!material) throw new Error("Material not found");

  const currentQty = material.balance?.quantity ?? 0;
  const newQty = Number(currentQty) + quantity;

  return db.$transaction(async (tx) => {
    // Ledger entry
    const txn = await tx.inventoryTransaction.create({
      data: {
        storeId,
        materialId,
        type: quantity >= 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        quantity: Math.abs(quantity),
        unit: material.unit,
        referenceType: "ADJUSTMENT",
        reason,
        note: note ?? null,
        userId: userId ?? null,
      },
    });

    // Update balance (upsert is safe; balance row is created in createMaterial)
    await tx.inventoryBalance.upsert({
      where: { materialId },
      update: { quantity: newQty },
      create: { storeId, materialId, quantity: newQty },
    });

    await tx.auditLog.create({
      data: {
        storeId,
        userId: userId ?? null,
        action: "INVENTORY_ADJUSTMENT",
        entity: "Material",
        entityId: materialId,
        before: { quantity: Number(currentQty) },
        after: { quantity: newQty },
        metadata: { reason, note, transactionId: txn.id },
      },
    });

    return { transaction: txn, newBalance: newQty };
  });
}

// ─── Inventory History ────────────────────────────────────────────────────────

export async function getMaterialHistory(
  storeId: string,
  materialId: string,
  limit = 50
) {
  return db.inventoryTransaction.findMany({
    where: { storeId, materialId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getLowStockMaterials(storeId: string) {
  // Returns materials where balance < reorderLevel
  const balances = await db.inventoryBalance.findMany({
    where: { storeId },
    include: {
      material: {
        include: { materialType: true },
      },
    },
  });

  return balances.filter(
    (b) =>
      b.material.reorderLevel !== null &&
      Number(b.quantity) < Number(b.material.reorderLevel)
  );
}

// ─── Material Types CRUD ──────────────────────────────────────────────────────

export async function createMaterialType(
  storeId: string,
  name: string,
  code: string
) {
  return db.materialType.create({
    data: { storeId, name, code },
  });
}

// ─── Supplier CRUD ────────────────────────────────────────────────────────────

export async function createSupplier(
  storeId: string,
  data: {
    name: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
  }
) {
  return db.supplier.create({
    data: { storeId, ...data },
  });
}

export async function updateSupplier(
  storeId: string,
  supplierId: string,
  data: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    active?: boolean;
  }
) {
  const existing = await db.supplier.findFirst({
    where: { id: supplierId, storeId },
  });
  if (!existing) throw new Error("Supplier not found");
  return db.supplier.update({ where: { id: supplierId }, data });
}
