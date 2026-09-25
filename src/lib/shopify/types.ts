/**
 * Narrow types for the fields we actually read from the Shopify GraphQL
 * Admin API. Not a full schema mirror — extend as new fields are needed.
 */

export type Money = { shopMoney: { amount: string } };

export type ShopifyVariantNode = {
  id: string; // gid://shopify/ProductVariant/...
  title: string;
  sku: string | null;
  price: string;
};

export type ShopifyProductNode = {
  id: string; // gid://shopify/Product/...
  title: string;
  handle: string | null;
  status: string;
  updatedAt: string;
  variants: { edges: { node: ShopifyVariantNode }[] };
};

export type ShopifyOrderLineItemNode = {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  variant: { id: string } | null;
  originalUnitPriceSet: Money;
  totalDiscountSet: Money;
};

export type ShopifyRefundLineItemNode = {
  lineItem: { id: string } | null;
  quantity: number;
  restockType: string | null;
};

export type ShopifyRefundNode = {
  id: string;
  createdAt: string;
  note: string | null;
  totalRefundedSet: Money;
  refundLineItems: { edges: { node: ShopifyRefundLineItemNode }[] };
};

export type ShopifyOrderNode = {
  id: string; // gid://shopify/Order/...
  name: string; // "#1001"
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  currencyCode: string;
  subtotalPriceSet: Money;
  totalShippingPriceSet: Money;
  totalTaxSet: Money;
  totalDiscountsSet: Money;
  totalPriceSet: Money;
  totalRefundedSet: Money;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string } | null;
  lineItems: { edges: { node: ShopifyOrderLineItemNode }[] };
  refunds: ShopifyRefundNode[];
};

export type PageInfo = { hasNextPage: boolean; endCursor: string | null };
