import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/services/product.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "products.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const storeId = getStoreId(session);
    const { id } = await params;

    const product = await getProduct(storeId, id);
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: product });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Keep order and recipe history intact; archived products disappear from the
// active catalog and can no longer be selected for new manual orders.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "products.write"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    const product = await db.product.findFirst({
      where: { id, storeId: getStoreId(session), NOT: { status: "ARCHIVED" } },
      select: { id: true, shopifyId: true },
    });
    if (!product) return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
    await db.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: { status: "ARCHIVED" } });
      await tx.auditLog.create({ data: {
        storeId: getStoreId(session), userId: session.userId,
        action: "ARCHIVE", entity: "Product", entityId: id,
        metadata: { shopifyId: product.shopifyId },
      } });
    });
    return NextResponse.json({ data: { archived: true, shopifyStillPublished: !!product.shopifyId } });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
