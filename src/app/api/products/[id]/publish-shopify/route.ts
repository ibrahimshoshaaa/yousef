import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { publishProductToShopify } from "@/services/shopify/product-publish.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "products.write") || !can(session.role, "shopify.write")) {
      return NextResponse.json({ error: "غير مسموح بنشر المنتج" }, { status: 403 });
    }
    const { id } = await params;
    const product = await publishProductToShopify(session.storeId, id);
    return NextResponse.json({ data: { id: product.id, shopifyId: product.shopifyId } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "سجل الدخول أولًا" }, { status: 401 });
    if (error instanceof Error && /غير موجود/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof Error && /صلاحية|اربط|الحجم الواحد|Shopify/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Publishing product to Shopify failed", error);
    return NextResponse.json({ error: "تعذر نشر المنتج في Shopify؛ حاول مجددًا" }, { status: 502 });
  }
}
