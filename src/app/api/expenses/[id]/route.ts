import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "expenses.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const expense = await db.expense.findFirst({
      where: { id, storeId: session.storeId },
      select: {
        id: true, amount: true, currency: true, date: true,
        description: true, reference: true, returnId: true, purchaseId: true,
        category: { select: { name: true } },
        return: { select: {
          id: true, status: true, reason: true, processedAt: true,
          order: { select: {
            id: true, orderNumber: true, customerRef: true,
            customerPhone: true, customerAddress: true, total: true,
            currency: true, occurredAt: true,
          } },
          items: { select: {
            quantity: true, condition: true, restocked: true,
            orderItem: { select: { title: true } },
          } },
        } },
        purchase: { select: {
          reference: true,
          supplier: { select: { name: true } },
          items: { select: {
            quantity: true,
            material: { select: { name: true, unit: true } },
          } },
        } },
      },
    });
    if (!expense) return NextResponse.json({ error: "المصروف غير موجود" }, { status: 404 });
    return NextResponse.json({ data: expense }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Expense details failed", error);
    return NextResponse.json({ error: "تعذر تحميل تفاصيل المصروف" }, { status: 500 });
  }
}
