import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getSetting } from "@/lib/settings";

/**
 * Chunk 5 — Consumption Engine (spec §24–§28).
 *
 * The business does not pre-manufacture finished products; a product is
 * "made" — and its recipe materials consumed — only when an order reaches
 * the store's configured trigger point. This module owns that decision and
 * the atomic ledger side-effects, per order line item:
 *
 *   resolve variant → resolve current recipe version → calculate required
 *   quantities → validate stock per the negative-stock policy → write
 *   Consumption + ConsumptionItem + InventoryTransaction + balance update,
 *   all in one DB transaction (spec §27).
 *
 * It is called automatically from order-sync.service.ts every time an order
 * snapshot is upserted (initial sync, manual resync, or any order/refund
 * webhook), and can be re-run manually via POST /api/orders/[id]/consume —
 * both paths funnel through `processOrderConsumption` below, so there is
 * exactly one code path that ever creates a Consumption record.
 *
 * ── Idempotency ──────────────────────────────────────────────────────────
 * `Consumption.orderItemId` is unique. Once an order line has a Consumption
 * row, `consumptionStatus` is "CONSUMED" and it is never revisited — a
 * re-sync, a duplicate webhook delivery, or a manual retry all no-op for
 * that line. This is a second, independent idempotency layer on top of
 * WebhookEvent's (storeId, eventId) guard (spec §28): even if consumption
 * were ever triggered from a path that bypassed the webhook table, it still
 * cannot double-consume a given order line.
 *
 * ── Assumptions documented per spec §5.14 / §79.22 ──────────────────────
 * 1. ORDER_PAID is interpreted as `Order.financialStatus === "PAID"` exactly
 *    (Shopify's OrderDisplayFinancialStatus enum). PARTIALLY_PAID orders do
 *    not trigger consumption under this setting — the spec does not define
 *    partial-payment behaviour, and treating a partial payment as "paid in
 *    full" for material-consumption purposes seemed the riskier default.
 * 2. RecipeItem.quantity/unit is assumed to already be expressed in the
 *    target Material's base unit — no unit conversion is performed. This
 *    mirrors the same assumption already implicit in
 *    recipe.service.ts's cost calculation (Chunk 3).
 * 3. Consumption is one-directional in this chunk: if an order's status
 *    later regresses (e.g. voided after being marked paid), already-created
 *    Consumption records are not reversed here. Returning materials to
 *    stock for a cancelled/returned order is Chunk 6's return-restocking
 *    flow (spec §32), which restocks based on the returned item's
 *    condition rather than simply undoing this chunk's ledger entries.
 * 4. Consumption is processed per order LINE ITEM, each in its own DB
 *    transaction — not one giant transaction for the whole order. Spec §27
 *    lists a per-order-shaped flow, but committing atomically per line
 *    means one line item with a missing recipe (a visible, correctable
 *    operational error — spec §23) never blocks material consumption for
 *    the order's other, correctly-mapped line items. Each line's own
 *    multi-material consumption remains fully atomic.
 */

export type ConsumptionStatus =
  | "PENDING" // trigger not met yet, or not attempted
  | "NO_VARIANT" // line item isn't linked to a known ProductVariant (custom/manual line)
  | "NO_RECIPE" // variant has no active recipe — visible operational error (spec §23)
  | "INSUFFICIENT_STOCK" // blocked by BLOCK_NEGATIVE_STOCK policy
  | "CONSUMED" // success — terminal, never reprocessed
  | "ERROR"; // unexpected failure

const RETRYABLE_STATUSES: ConsumptionStatus[] = [
  "PENDING",
  "NO_RECIPE",
  "INSUFFICIENT_STOCK",
  "ERROR",
];

class InsufficientStockError extends Error {}

function isTriggerSatisfied(
  trigger: string,
  order: { financialStatus: string | null; fulfillmentStatus: string | null }
): boolean {
  switch (trigger) {
    case "ORDER_CREATED":
      return true;
    case "ORDER_PAID":
      return order.financialStatus === "PAID";
    case "ORDER_FULFILLED":
      return order.fulfillmentStatus === "FULFILLED";
    default:
      // Unknown/misconfigured setting value — the safest default is to not
      // silently consume inventory (spec principle §5.12).
      return false;
  }
}

function round(n: number): number {
  // Six decimal places matches the schema's Decimal(18, 6) quantity columns.
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Attempts consumption for every eligible (non-terminal) line item on an
 * order. Safe to call any number of times for the same order — items
 * already CONSUMED or NO_VARIANT are skipped without touching the DB.
 *
 * Returns a summary rather than throwing on a per-line failure — a single
 * bad line item (missing recipe, insufficient stock) must not prevent the
 * rest of the order's lines from being processed or prevent the caller
 * (order sync / webhook handling) from completing successfully.
 */
export async function processOrderConsumption(
  storeId: string,
  orderId: string
): Promise<{
  triggered: boolean;
  consumed: number;
  skipped: number;
  failed: number;
}> {
  const order = await db.order.findFirst({
    where: { id: orderId, storeId },
    select: { id: true, financialStatus: true, fulfillmentStatus: true, orderNumber: true },
  });
  if (!order) throw new Error("Order not found");

  const trigger = await getSetting(storeId, "orderConsumptionTrigger");
  if (!isTriggerSatisfied(trigger, order)) {
    return { triggered: false, consumed: 0, skipped: 0, failed: 0 };
  }

  const negativeStockPolicy = await getSetting(storeId, "negativeStockPolicy");

  const eligibleItems = await db.orderItem.findMany({
    where: {
      orderId,
      consumptionStatus: { in: RETRYABLE_STATUSES },
    },
    select: { id: true },
  });

  let consumed = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of eligibleItems) {
    const status = await processOrderItemConsumption(
      storeId,
      item.id,
      negativeStockPolicy,
      order.orderNumber
    );
    if (status === "CONSUMED") consumed++;
    else if (status === "NO_VARIANT") skipped++;
    else failed++;
  }

  return { triggered: true, consumed, skipped, failed };
}

/**
 * Resolves and consumes materials for a single order line item. Never
 * throws — always leaves the item in a terminal-for-now status and returns
 * it, so callers (including the batch loop above) can proceed unconditionally.
 */
export async function processOrderItemConsumption(
  storeId: string,
  orderItemId: string,
  negativeStockPolicyOverride?: string,
  orderNumberForMessages?: string | null
): Promise<ConsumptionStatus> {
  const item = await db.orderItem.findFirst({
    where: { id: orderItemId, order: { storeId } },
  });
  if (!item) return "ERROR";

  // Terminal states are never revisited — this is the idempotency guard.
  if (item.consumptionStatus === "CONSUMED") return "CONSUMED";

  if (!item.variantId) {
    await db.orderItem.update({
      where: { id: item.id },
      data: { consumptionStatus: "NO_VARIANT", consumptionError: null },
    });
    return "NO_VARIANT";
  }

  const recipe = await db.recipe.findUnique({
    where: { storeId_variantId: { storeId, variantId: item.variantId } },
    include: {
      versions: {
        where: { isCurrent: true },
        include: { items: { include: { material: true } } },
        take: 1,
      },
      variant: true,
    },
  });
  const version = recipe?.versions[0] ?? null;

  if (!recipe || !version) {
    const label = recipe?.variant.title ?? item.title;
    await db.orderItem.update({
      where: { id: item.id },
      data: {
        consumptionStatus: "NO_RECIPE",
        consumptionError: `Cannot process order${
          orderNumberForMessages ? ` ${orderNumberForMessages}` : ""
        }: recipe missing for ${label}.`,
      },
    });
    return "NO_RECIPE";
  }

  const negativeStockPolicy =
    negativeStockPolicyOverride ?? (await getSetting(storeId, "negativeStockPolicy"));

  // Ledger/balance quantities use the material's own tracked unit
  // (`material.unit`), not the recipe item's free-text `unit` string — this
  // matches adjustInventory's convention elsewhere (material.service.ts) so
  // a material's balance is always expressed in one consistent unit
  // regardless of which recipe references it. Per Assumption #2 above, the
  // recipe item's quantity is trusted to already be in that same unit.
  const required = version.items.map((ri) => ({
    materialId: ri.materialId,
    materialName: ri.material.name,
    unit: ri.material.unit,
    quantity: round(Number(ri.quantity) * Number(item.quantity)),
  }));

  try {
    await db.$transaction(async (tx) => {
      const warnings: string[] = [];
      const insufficient: string[] = [];

      for (const req of required) {
        const balance = await tx.inventoryBalance.upsert({
          where: { materialId: req.materialId },
          create: { storeId, materialId: req.materialId, quantity: -req.quantity },
          update: { quantity: { decrement: req.quantity } },
        });

        if (Number(balance.quantity) < 0) {
          const msg = `${req.materialName}: short by ${Math.abs(Number(balance.quantity))} ${req.unit}`;
          if (negativeStockPolicy === "BLOCK_NEGATIVE_STOCK") insufficient.push(msg);
          else if (negativeStockPolicy === "WARN_ONLY") warnings.push(msg);
          // ALLOW_NEGATIVE_STOCK: proceed silently.
        }
      }

      if (insufficient.length > 0) {
        throw new InsufficientStockError(
          `Cannot consume materials for order${
            orderNumberForMessages ? ` ${orderNumberForMessages}` : ""
          }: insufficient stock — ${insufficient.join("; ")}.`
        );
      }

      const consumption = await tx.consumption.create({
        data: {
          storeId,
          orderId: item.orderId,
          orderItemId: item.id,
          variantId: item.variantId!,
          recipeVersionId: version.id,
          quantity: item.quantity,
          items: {
            create: required.map((r) => ({
              materialId: r.materialId,
              quantity: r.quantity,
              unit: r.unit,
            })),
          },
        },
      });

      for (const req of required) {
        await tx.inventoryTransaction.create({
          data: {
            storeId,
            materialId: req.materialId,
            type: "CONSUMPTION",
            quantity: req.quantity,
            unit: req.unit,
            referenceType: "ORDER_ITEM",
            referenceId: item.id,
            reason: `Order${orderNumberForMessages ? ` ${orderNumberForMessages}` : ""} consumption`,
          },
        });
      }

      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          consumptionStatus: "CONSUMED",
          consumptionError: null,
          recipeVersionId: version.id,
        },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          action: "CREATE",
          entity: "Consumption",
          entityId: consumption.id,
          after: { orderId: item.orderId, orderItemId: item.id, materials: required } as unknown as Prisma.JsonObject,
          metadata: warnings.length ? { negativeStockWarnings: warnings } : undefined,
        },
      });

      if (warnings.length > 0) {
        await tx.auditLog.create({
          data: {
            storeId,
            action: "CONSUMPTION_NEGATIVE_STOCK_WARNING",
            entity: "OrderItem",
            entityId: item.id,
            metadata: { warnings } as unknown as Prisma.JsonObject,
          },
        });
      }
    });

    return "CONSUMED";
  } catch (err) {
    // A duplicate Consumption row (orderItemId unique constraint) means a
    // concurrent process already succeeded for this exact line — treat as
    // success rather than surfacing a spurious error to the operator.
    if (isUniqueConstraintError(err)) {
      return "CONSUMED";
    }

    const message = err instanceof Error ? err.message : String(err);
    const status: ConsumptionStatus =
      err instanceof InsufficientStockError ? "INSUFFICIENT_STOCK" : "ERROR";

    await db.orderItem.update({
      where: { id: item.id },
      data: { consumptionStatus: status, consumptionError: message.slice(0, 2000) },
    });
    return status;
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

// ─── Queries (consumption history + items needing attention) ────────────────

export async function listConsumption(
  storeId: string,
  opts: { orderId?: string; materialId?: string; variantId?: string; limit?: number } = {}
) {
  const where: Prisma.ConsumptionWhereInput = {
    storeId,
    ...(opts.orderId ? { orderId: opts.orderId } : {}),
    ...(opts.variantId ? { variantId: opts.variantId } : {}),
    ...(opts.materialId ? { items: { some: { materialId: opts.materialId } } } : {}),
  };

  return db.consumption.findMany({
    where,
    include: {
      order: { select: { id: true, orderNumber: true, occurredAt: true } },
      variant: { include: { product: true } },
      recipeVersion: { select: { id: true, version: true } },
      items: { include: { material: { select: { id: true, name: true, unit: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });
}

/** Order lines with a real, actionable consumption problem (spec §23). */
export async function listOrderItemsNeedingAttention(storeId: string, limit = 50) {
  return db.orderItem.findMany({
    where: {
      order: { storeId },
      consumptionStatus: { in: ["NO_RECIPE", "INSUFFICIENT_STOCK", "ERROR"] },
    },
    include: {
      order: { select: { id: true, orderNumber: true, occurredAt: true } },
      variant: { include: { product: true } },
    },
    orderBy: { order: { occurredAt: "desc" } },
    take: limit,
  });
}
