import { db } from "@/lib/db";

export const DEFAULT_SETTINGS = {
  currency: "EGP",
  timezone: "Africa/Cairo",
  negativeStockPolicy: "BLOCK_NEGATIVE_STOCK",
  orderConsumptionTrigger: "ORDER_PAID",
  defaultReturnCost: "95",
  returnRestocking: "CONFIGURABLE",
  costingEnabled: "false",
  materialCostMethod: "DEFAULT_COST",
  defaultReorderLevel: "0",
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

/**
 * Reads a single store setting, falling back to DEFAULT_SETTINGS when no
 * row exists yet for the store. Settings are stored as plain strings
 * (key/value) per the Setting model — callers coerce as needed.
 */
export async function getSetting(
  storeId: string,
  key: SettingKey
): Promise<string> {
  const row = await db.setting.findUnique({
    where: { storeId_key: { storeId, key } },
  });
  return row?.value ?? DEFAULT_SETTINGS[key];
}

export async function isCostingEnabled(storeId: string): Promise<boolean> {
  return (await getSetting(storeId, "costingEnabled")) === "true";
}
