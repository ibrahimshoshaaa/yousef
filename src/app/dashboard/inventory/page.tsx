import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";

async function getDevStoreId() {
  const session = await requireAuth();
  if (!can(session.role, "inventory.read")) throw new Error("Forbidden");
  return session.storeId;
}

const txTypeLabels: Record<string, string> = {
  ADJUSTMENT_IN: "تسوية +",
  ADJUSTMENT_OUT: "تسوية −",
  CONSUMPTION: "استهلاك",
  PURCHASE: "شراء",
  RETURN_RESTOCK: "إرجاع للمخزون",
  WASTE: "هالك",
  OPENING: "رصيد افتتاحي",
};

async function InventoryContent({ storeId }: { storeId: string }) {
  const [balances, recent] = await Promise.all([
    db.inventoryBalance.findMany({
      where: { storeId },
      include: {
        material: { include: { materialType: true } },
      },
      orderBy: { material: { name: "asc" } },
    }),
    db.inventoryTransaction.findMany({
      where: { storeId },
      include: {
        material: { select: { name: true, unit: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const lowStock = balances.filter(
    (b) =>
      b.material.reorderLevel !== null &&
      Number(b.quantity) < Number(b.material.reorderLevel)
  );

  return (
    <div className="space-y-6">
      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="mb-3 font-semibold text-red-700">
            ⚠ مواد منخفضة ({lowStock.length})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lowStock.map((b) => (
              <Link
                key={b.id}
                href={`/dashboard/materials/${b.materialId}`}
                className="flex items-center justify-between rounded-lg border border-red-200 bg-white px-3 py-2 text-sm hover:bg-red-50"
              >
                <span className="font-medium">{b.material.name}</span>
                <span className="font-mono text-red-600">
                  {Number(b.quantity).toFixed(2)} {b.material.unit}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Balances table */}
      <div>
        <h2 className="mb-3 font-semibold">أرصدة المخزون</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-gray-50 text-right text-xs text-gray-500">
                <th className="px-4 py-3">المادة</th>
                <th className="px-4 py-3">النوع</th>
                <th className="px-4 py-3 text-center">الرصيد</th>
                <th className="px-4 py-3 text-center">حد إعادة الطلب</th>
                <th className="px-4 py-3 text-center">الحالة</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {balances.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-sm text-gray-400"
                  >
                    لا توجد مواد بعد
                  </td>
                </tr>
              ) : (
                balances.map((b) => {
                  const qty = Number(b.quantity);
                  const reorder = b.material.reorderLevel
                    ? Number(b.material.reorderLevel)
                    : null;
                  const isLow = reorder !== null && qty < reorder;
                  return (
                    <tr
                      key={b.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 font-medium">
                        {b.material.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {b.material.materialType.name}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        <span className={isLow ? "text-red-600 font-semibold" : ""}>
                          {qty.toFixed(2)} {b.material.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {reorder !== null
                          ? `${reorder.toFixed(2)} ${b.material.unit}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isLow ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                            منخفض
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            كافٍ
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-left">
                        <Link
                          href={`/dashboard/materials/${b.materialId}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          تسوية
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent transactions */}
      <div>
        <h2 className="mb-3 font-semibold">آخر الحركات</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-gray-50 text-right text-xs text-gray-500">
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">المادة</th>
                <th className="px-4 py-3">النوع</th>
                <th className="px-4 py-3 text-center">الكمية</th>
                <th className="px-4 py-3">السبب</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 text-center text-sm text-gray-400"
                  >
                    لا توجد حركات بعد
                  </td>
                </tr>
              ) : (
                recent.map((txn) => {
                  const isIn = [
                    "ADJUSTMENT_IN",
                    "PURCHASE",
                    "RETURN_RESTOCK",
                    "OPENING",
                  ].includes(txn.type);
                  return (
                    <tr
                      key={txn.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(txn.createdAt).toLocaleString("ar-EG")}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {txn.material.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {txTypeLabels[txn.type] ?? txn.type}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-mono font-semibold ${isIn ? "text-green-600" : "text-red-600"}`}
                        >
                          {isIn ? "+" : "−"}
                          {Number(txn.quantity).toFixed(2)} {txn.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {txn.reason ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default async function InventoryPage() {
  const storeId = await getDevStoreId();

  return (
    <div className="p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">المخزون</p>
          <h1 className="mt-1 text-2xl font-bold">المخزون</h1>
        </div>
      </header>

      {storeId ? (
        <Suspense
          fallback={
            <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
          }
        >
          <InventoryContent storeId={storeId} />
        </Suspense>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-gray-400">
          لم يتم إنشاء متجر بعد
        </div>
      )}
    </div>
  );
}
