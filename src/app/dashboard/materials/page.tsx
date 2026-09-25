import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";

async function getDevStoreId() {
  const session = await requireAuth();
  if (!can(session.role, "materials.read")) throw new Error("Forbidden");
  return session.storeId;
}

async function MaterialsTable({ storeId }: { storeId: string }) {
  const materials = await db.material.findMany({
    where: { storeId, active: true },
    include: {
      materialType: true,
      supplier: true,
      balance: true,
    },
    orderBy: { name: "asc" },
  });

  if (materials.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-gray-400">
        لا توجد مواد خام بعد — أضف أول مادة
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-gray-50 text-right text-xs text-gray-500">
            <th className="px-4 py-3">الاسم</th>
            <th className="px-4 py-3">النوع</th>
            <th className="px-4 py-3">المورد</th>
            <th className="px-4 py-3">الوحدة</th>
            <th className="px-4 py-3 text-center">الرصيد</th>
            <th className="px-4 py-3 text-center">حد إعادة الطلب</th>
            <th className="px-4 py-3 text-center">الحالة</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {materials.map((m) => {
            const balance = Number(m.balance?.quantity ?? 0);
            const reorder = Number(m.reorderLevel ?? 0);
            const isLow = m.reorderLevel !== null && balance < reorder;

            return (
              <tr
                key={m.id}
                className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {m.materialType.name}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {m.supplier?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-500">{m.unit}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`font-mono ${isLow ? "font-semibold text-red-600" : ""}`}
                  >
                    {balance.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-500">
                  {m.reorderLevel !== null ? Number(m.reorderLevel).toFixed(2) : "—"}
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
                    href={`/dashboard/materials/${m.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    تفاصيل
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function MaterialsPage() {
  const storeId = await getDevStoreId();

  return (
    <div className="p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">المخزون</p>
          <h1 className="mt-1 text-2xl font-bold">المواد الخام</h1>
        </div>
        <Link
          href="/dashboard/materials/new"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + إضافة مادة
        </Link>
      </header>

      {storeId ? (
        <Suspense
          fallback={
            <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
          }
        >
          <MaterialsTable storeId={storeId} />
        </Suspense>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-gray-400">
          لم يتم إنشاء متجر بعد
        </div>
      )}
    </div>
  );
}
