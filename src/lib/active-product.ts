import type { Prisma } from "@prisma/client";

// Older locally created products may have no status. They remain sellable.
export const activeProductStatus: Prisma.ProductWhereInput = {
  OR: [{ status: null }, { status: { not: "ARCHIVED" } }],
};
