import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listProducts, createProduct } from "@/services/product.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

// Manual product creation is a fallback for entering data before the
// Shopify connection (Chunk 4) is live. Once Shopify sync ships, products
// are expected to arrive with a shopifyId and this endpoint becomes a
// rarely-used escape hatch for store-only test SKUs.
const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  handle: z.string().trim().max(200).optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "products.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storeId = getStoreId(session);
    const { searchParams } = new URL(req.url);

    const products = await listProducts(storeId, {
      search: searchParams.get("search") ?? undefined,
    });

    return NextResponse.json({ data: products });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "products.write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storeId = getStoreId(session);
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const product = await createProduct({ storeId, ...parsed });
    return NextResponse.json({ data: product }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Validation error", issues: err.issues },
      { status: 422 }
    );
  }
  if (err instanceof Error && err.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
