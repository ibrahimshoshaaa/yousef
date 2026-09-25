import { z } from "zod";

export const storeCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  currency: z.string().trim().length(3).default("EGP"),
  timezone: z.string().trim().min(1).default("Africa/Cairo"),
});

export const materialSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().max(100).optional(),
  unit: z.string().trim().min(1).max(30),
  baseUnit: z.string().trim().min(1).max(30),
  defaultCost: z.coerce.number().nonnegative().optional(),
  reorderLevel: z.coerce.number().nonnegative().optional(),
});
