import { db } from "@/lib/db";
import { syncAllProducts } from "@/services/shopify/product-sync.service";
import { syncAllOrders } from "@/services/shopify/order-sync.service";
import { registerWebhooks } from "@/services/shopify/connection.service";

/**
 * Full sync flow per spec §54:
 *   Sync Products → Sync Variants (nested) → Sync Orders → Sync Refunds/Returns
 *   (nested in orders) → Register webhooks → Mark sync complete
 *
 * Each stage is its own SyncJob row so a failure partway through is visible
 * and resumable by re-running (products/orders upserts are idempotent on
 * shopifyId, so a re-run is safe — spec §55 "large syncs should be
 * resumable"). This is also what the "manual resync" dashboard button and
 * the OAuth callback both call.
 */
export async function runFullSync(storeId: string): Promise<void> {
  await db.syncState.upsert({
    where: { storeId },
    update: { status: "SYNCING", lastAttemptAt: new Date(), lastError: null },
    create: { storeId, status: "SYNCING", lastAttemptAt: new Date() },
  });

  try {
    await runStage(storeId, "PRODUCTS", () => syncAllProducts(storeId));
    await runStage(storeId, "ORDERS", () => syncAllOrders(storeId));
    await runStage(storeId, "WEBHOOKS", async () => {
      await registerWebhooks(storeId);
      return { count: 0 };
    });

    await db.$transaction([
      db.syncState.update({
        where: { storeId },
        data: { status: "IDLE", lastSuccessfulAt: new Date(), lastError: null },
      }),
      db.shopifyConnection.update({
        where: { storeId },
        data: { lastSyncAt: new Date() },
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.syncState.update({
      where: { storeId },
      data: { status: "ERROR", lastError: message.slice(0, 2000) },
    });
    throw err;
  }
}

async function runStage(
  storeId: string,
  type: "PRODUCTS" | "ORDERS" | "WEBHOOKS",
  fn: () => Promise<{ count: number }>
) {
  const job = await db.syncJob.create({
    data: { storeId, type, status: "RUNNING", startedAt: new Date() },
  });

  try {
    const result = await fn();
    await db.syncJob.update({
      where: { id: job.id },
      data: { status: "SUCCEEDED", finishedAt: new Date(), cursor: String(result.count) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.syncJob.update({
      where: { id: job.id },
      data: { status: "FAILED", finishedAt: new Date(), error: message.slice(0, 2000) },
    });
    throw err;
  }
}
