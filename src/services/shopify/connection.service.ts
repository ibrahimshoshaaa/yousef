import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { encryptToken, decryptToken } from "@/lib/shopify/crypto";
import { ShopifyClient } from "@/lib/shopify/client";
import { SUBSCRIBED_WEBHOOK_TOPICS } from "@/lib/shopify/topics";
import { getShopifyConfig } from "@/lib/config";

export async function getConnectionStatus(storeId: string) {
  const [connection, syncState, recentJobs, recentWebhooks] = await Promise.all([
    db.shopifyConnection.findUnique({ where: { storeId } }),
    db.syncState.findUnique({ where: { storeId } }),
    db.syncJob.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.webhookEvent.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const failedEventCount = await db.webhookEvent.count({
    where: { storeId, status: "FAILED" },
  });

  return { connection, syncState, recentJobs, recentWebhooks, failedEventCount };
}

/**
 * Persists the connection after a successful OAuth exchange. Called once
 * from the /api/shopify/callback route. Store's access token is encrypted
 * at rest; ShopifyConnection tracks status/metadata for the dashboard.
 */
export async function saveConnection(params: {
  storeId: string;
  shopDomain: string;
  accessToken: string;
  scope: string;
  shopifyShopId: string;
}) {
  const config = getShopifyConfig();
  const encrypted = encryptToken(params.accessToken, config.tokenEncryptionKey);

  return db.$transaction(async (tx) => {
    await tx.store.update({
      where: { id: params.storeId },
      data: {
        shopifyShopDomain: params.shopDomain,
        encryptedShopifyAccessToken: encrypted,
      },
    });

    const connection = await tx.shopifyConnection.upsert({
      where: { storeId: params.storeId },
      update: {
        shopDomain: params.shopDomain,
        shopifyShopId: params.shopifyShopId,
        apiVersion: config.apiVersion,
        scope: params.scope,
        connectedAt: new Date(),
        status: "CONNECTED",
        lastError: null,
      },
      create: {
        storeId: params.storeId,
        shopDomain: params.shopDomain,
        shopifyShopId: params.shopifyShopId,
        apiVersion: config.apiVersion,
        scope: params.scope,
        connectedAt: new Date(),
        status: "CONNECTED",
      },
    });

    await tx.auditLog.create({
      data: {
        storeId: params.storeId,
        action: "SHOPIFY_CONNECT",
        entity: "ShopifyConnection",
        entityId: connection.id,
        after: { shopDomain: params.shopDomain } as unknown as Prisma.JsonObject,
      },
    });

    return connection;
  });
}

export async function disconnectStore(storeId: string, userId?: string | null) {
  return db.$transaction(async (tx) => {
    await tx.store.update({
      where: { id: storeId },
      data: { encryptedShopifyAccessToken: null },
    });

    const connection = await tx.shopifyConnection.update({
      where: { storeId },
      data: { status: "DISCONNECTED", lastError: null },
    });

    await tx.auditLog.create({
      data: {
        storeId,
        userId: userId ?? null,
        action: "SHOPIFY_DISCONNECT",
        entity: "ShopifyConnection",
        entityId: connection.id,
      },
    });

    return connection;
  });
}

export async function markConnectionError(storeId: string, error: string) {
  await db.shopifyConnection.updateMany({
    where: { storeId },
    data: { status: "ERROR", lastError: error.slice(0, 2000) },
  });
}

/**
 * Builds an authenticated ShopifyClient for a store, or throws if the
 * store isn't connected. Every sync/webhook handler goes through this
 * rather than reading Store.encryptedShopifyAccessToken directly.
 */
export async function getClientForStore(storeId: string): Promise<ShopifyClient> {
  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store?.shopifyShopDomain || !store.encryptedShopifyAccessToken) {
    throw new Error("STORE_NOT_CONNECTED");
  }

  const config = getShopifyConfig();
  const accessToken = decryptToken(store.encryptedShopifyAccessToken, config.tokenEncryptionKey);

  return new ShopifyClient(store.shopifyShopDomain, accessToken, config.apiVersion);
}

/** Registers every topic in SUBSCRIBED_WEBHOOK_TOPICS against our webhook endpoint. */
export async function registerWebhooks(storeId: string) {
  const client = await getClientForStore(storeId);
  const config = getShopifyConfig();
  const callbackUrl = `${config.appUrl}/api/webhooks/shopify`;

  const failures: string[] = [];
  for (const topic of SUBSCRIBED_WEBHOOK_TOPICS) {
    try {
      await client.registerWebhook(topic, callbackUrl);
    } catch (err) {
      failures.push(`${topic}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await db.shopifyConnection.update({
    where: { storeId },
    data: {
      webhooksRegisteredAt: new Date(),
      ...(failures.length
        ? { lastError: `Some webhooks failed to register: ${failures.join(" | ")}` }
        : {}),
    },
  });

  if (failures.length) {
    throw new Error(`Webhook registration incomplete: ${failures.join(" | ")}`);
  }
}
