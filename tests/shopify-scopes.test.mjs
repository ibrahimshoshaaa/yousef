import test from "node:test";
import assert from "node:assert/strict";
import { hasShopifyScope } from "../src/lib/shopify/scopes.ts";

test("Shopify write fulfillment-order scope grants matching read access", () => {
  const granted = new Set(["write_merchant_managed_fulfillment_orders", "write_fulfillments"]);
  assert.equal(hasShopifyScope(granted, "read_merchant_managed_fulfillment_orders"), true);
  assert.equal(hasShopifyScope(granted, "read_fulfillments"), true);
  assert.equal(hasShopifyScope(granted, "write_merchant_managed_fulfillment_orders"), true);
  assert.equal(hasShopifyScope(granted, "write_assigned_fulfillment_orders"), false);
});
