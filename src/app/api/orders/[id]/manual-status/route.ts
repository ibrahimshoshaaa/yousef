import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { manualOrderStatuses, updateManualOrderStatus } from "@/services/manual-order.service";

const schema = z.object({ status: z.enum(manualOrderStatuses) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "orders.write")) return NextResponse.json({ error: "غير مسموح بتعديل الطلب" }, { status: 403 });
    const { status } = schema.parse(await request.json());
    if (status === "RETURNED" && !["returns.write", "expenses.write", "inventory.write"].every(permission => can(session.role, permission))) {
      return NextResponse.json({ error: "غير مسموح بمعالجة المرتجع" }, { status: 403 });
    }
    const { id } = await params;
    return NextResponse.json({ data: await updateManualOrderStatus({ storeId: session.storeId, orderId: id, userId: session.userId, status }) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "حالة غير صحيحة" }, { status: 422 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "سجّل الدخول أولًا" }, { status: 401 });
    if (error instanceof Error && /غير موجود|ليس طلبًا يدويًا/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof Error && /غير صحيح|تعذر خصم|لا يمكن|تغيرت|تعذر إنشاء|processed|restock|Restock|consumption|Manual return/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Manual order status update failed", error);
    return NextResponse.json({ error: "تعذر تحديث الطلب" }, { status: 500 });
  }
}
