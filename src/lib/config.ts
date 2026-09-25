import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export function getConfig() {
  return envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
}

// ─── Shopify (Chunk 4) ──────────────────────────────────────────────────────
// Optional at the env-validation layer: a deployment can run every other
// chunk without a Shopify app configured yet. Routes/services that actually
// need Shopify call getShopifyConfig() themselves and fail loudly there.

const shopifyEnvSchema = z.object({
  SHOPIFY_API_KEY: z.string().min(1, "SHOPIFY_API_KEY is not set"),
  SHOPIFY_API_SECRET: z.string().min(1, "SHOPIFY_API_SECRET is not set"),
  SHOPIFY_APP_URL: z.string().url("SHOPIFY_APP_URL must be a valid URL"),
  SHOPIFY_WEBHOOK_SECRET: z.string().optional(),
  SHOPIFY_SCOPES: z.string().min(1).default("read_products,read_orders,read_returns"),
  SHOPIFY_API_VERSION: z.string().min(1).default("2026-07"),
  SHOPIFY_TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(1, "SHOPIFY_TOKEN_ENCRYPTION_KEY is not set"),
});

export type ShopifyConfig = {
  apiKey: string;
  apiSecret: string;
  appUrl: string;
  webhookSecret: string;
  scopes: string[];
  apiVersion: string;
  tokenEncryptionKey: string;
};

export function isShopifyConfigured(): boolean {
  return shopifyEnvSchema.safeParse(process.env).success;
}

/** Throws with a clear message if the Shopify app isn't configured yet. */
export function getShopifyConfig(): ShopifyConfig {
  const parsed = shopifyEnvSchema.parse(process.env);
  return {
    apiKey: parsed.SHOPIFY_API_KEY,
    apiSecret: parsed.SHOPIFY_API_SECRET,
    appUrl: parsed.SHOPIFY_APP_URL.replace(/\/$/, ""),
    // Falls back to the app's client secret — Shopify signs webhook
    // payloads with it unless a distinct signing secret was issued.
    webhookSecret: parsed.SHOPIFY_WEBHOOK_SECRET || parsed.SHOPIFY_API_SECRET,
    scopes: parsed.SHOPIFY_SCOPES.split(",").map((s) => s.trim()).filter(Boolean),
    apiVersion: parsed.SHOPIFY_API_VERSION,
    tokenEncryptionKey: parsed.SHOPIFY_TOKEN_ENCRYPTION_KEY,
  };
}
