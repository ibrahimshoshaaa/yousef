-- Operational stage for Shopify orders, independent of Shopify's financial and
-- fulfillment snapshots. The latter remain sourced from Shopify.
ALTER TABLE "Order" ADD COLUMN "shopifyStage" TEXT;
