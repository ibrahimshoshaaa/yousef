import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { ShopifyWorkflowError, shopifyOrderStages, updateShopifyOrderStage } from "@/services/shopify/order-workflow.service";
import { ShopifyApiError } from "@/lib/shopify/client";

const schema = z.object({ status: z.enum(shopifyOrderStages) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "orders.write")) return NextResponse.json({ error: "غير مسموح بتعديل الطلب" }, { status: 403 });
    const { status } = schema.parse(await request.json());
    const { id } = await params;
    return NextResponse.json({ data: await updateShopifyOrderStage({ storeId: session.storeId, orderId: id, userId: session.userId, stage: status }) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "حالة غير صحيحة" }, { status: 422 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "سجّل الدخول أولًا" }, { status: 401 });
    if (error instanceof ShopifyWorkflowError) return NextResponse.json({ error: error.message }, { status: error.message.includes("غير موجود") ? 404 : 409 });
    if (error instanceof ShopifyApiError) {
      console.error("Shopify order transition failed", error);
      return NextResponse.json({ error: "تعذر تحديث Shopify. تحقق من صلاحيات الربط وحالة الطلب، ثم حاول مجددًا." }, { status: 502 });
    }
    console.error("Shopify order transition failed", error);
    return NextResponse.json({ error: "تعذر تحديث الطلب" }, { status: 500 });
  }
}
