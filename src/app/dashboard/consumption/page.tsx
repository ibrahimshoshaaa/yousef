import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { Suspense } from "react";
import Link from "next/link";
import {
  listConsumption,
  listOrderItemsNeedingAttention,
} from "@/services/consumption.service";
import { RetryOrderConsumptionButton } from "@/components/consumption/RetryOrderConsumptionButton";

async function getDevStoreId() {
  const session = await requireAuth();
  if (!can(session.role, "consumption.read")) throw new Error("Forbidden");
  return session.storeId;
}

const statusLabels: Record<string, string> = {
  NO_RECIPE: "لا توجد وصفة",
  INSUFFICIENT_STOCK: "مخزون غير كافٍ",
  ERROR: "خطأ",
};

async function AttentionSection({ storeId }: { storeId: string }) {
  const items = await listOrderItemsNeedingAttention(storeId);
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <h2 className="mb-3 font-semibold text-red-700">
        ⚠ بنود تحتاج مراجعة ({items.length})
      </h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-lg border border-red-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="text-sm font-medium">
                طلب #{item.order.orderNumber ?? item.order.id} —{" "}
                {item.variant?.product.title ?? item.title}
                {item.variant ? ` (${item.variant.title})` : ""}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                  {statusLabels[item.consumptionStatus] ?? item.consumptionStatus}
                </span>
                <span className="text-gray-500">
                  الكمية: {Number(item.quantity).toFixed(2)}
                </span>
              </div>
              {item.consumptionError && (
                <p className="mt-1 max-w-xl text-xs text-gray-500">
                  {item.consumptionError}
                </p>
              )}
            </div>
            <RetryOrderConsumptionButton orderId={item.order.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

async function HistorySection({
  storeId,
  orderId,
}: {
  storeId: string;
  orderId?: string;
}) {
  const consumption = await listConsumption(storeId, { limit: 100, orderId });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">سجل الاستهلاك</h2>
        {orderId && (
          <Link
            href="/dashboard/consumption"
            className="text-xs text-blue-600 hover:underline"
          >
            إلغاء تصفية الطلب ✕
          </Link>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-gray-50 text-right text-xs text-gray-500">
              <th className="px-4 py-3">التاريخ</th>
              <th className="px-4 py-3">الطلب</th>
              <th className="px-4 py-3">المنتج</th>
              <th className="px-4 py-3 text-center">الكمية المباعة</th>
              <th className="px-4 py-3 text-center">نسخة الوصفة</th>
              <th className="px-4 py-3">المواد المستهلكة</th>
            </tr>
          </thead>
          <tbody>
            {consumption.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-gray-400">
                  لا يوجد استهلاك مسجل بعد
                </td>
              </tr>
            ) : (
              consumption.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(c.createdAt).toLocaleString("ar-EG")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/consumption?orderId=${c.orderId}`}
                      className="text-blue-600 hover:underline"
                    >
                      #{c.order.orderNumber ?? c.orderId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {c.variant.product.title} ({c.variant.title})
                  </td>
                  <td className="px-4 py-3 text-center font-mono">
                    {Number(c.quantity).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">
                    v{c.recipeVersion.version}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {c.items
                      .map(
                        (it) =>
                          `${it.material.name}: ${Number(it.quantity).toFixed(2)} ${it.unit}`
                      )
                      .join(" · ")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function ConsumptionPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const storeId = await getDevStoreId();
  const { orderId } = await searchParams;

  return (
    <div className="p-4 md:p-8">
      <header className="mb-6">
        <p className="text-sm text-gray-500">المخزون</p>
        <h1 className="mt-1 text-2xl font-bold">الاستهلاك</h1>
        <p className="mt-1 text-sm text-gray-500">
          استهلاك المواد الناتج عن الطلبات — يتم تلقائيًا عند وصول الطلب لحالة
          التشغيل المحددة في الإعدادات (الافتراضي: عند الدفع).
        </p>
      </header>

      {storeId ? (
        <div className="space-y-6">
          <Suspense fallback={null}>
            <AttentionSection storeId={storeId} />
          </Suspense>
          <Suspense
            fallback={<div className="h-48 animate-pulse rounded-xl bg-gray-100" />}
          >
            <HistorySection storeId={storeId} orderId={orderId} />
          </Suspense>
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-gray-400">
          لم يتم إنشاء متجر بعد
        </div>
      )}
    </div>
  );
}
