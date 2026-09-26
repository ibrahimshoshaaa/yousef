-- Manual order customer, deposit, and fulfillment lifecycle.
ALTER TABLE "Order"
  ADD COLUMN "customerPhone" TEXT,
  ADD COLUMN "customerAddress" TEXT,
  ADD COLUMN "depositAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "manualStatus" TEXT;

-- Existing manual sales were already recorded as paid and fulfilled.
UPDATE "Order" SET "manualStatus" = 'DELIVERED' WHERE LEFT("id", 7) = 'manual_';
