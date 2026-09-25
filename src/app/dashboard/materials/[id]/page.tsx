import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { AdjustInventoryForm } from "@/components/materials/AdjustInventoryForm";

async function getDevStoreId() {
  const session = await requireAuth();
  if (!can(session.role, "materials.read")) throw new Error("Forbidden");
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

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await getDevStoreId();
  if (!storeId) notFound();

  const material = await db.material.findFirst({
    where: { id, storeId },
    include: {
      materialType: true,
      supplier: true,
      balance: true,
    },
  });
  if (!material) notFound();

  const history = await db.inventoryTransaction.findMany({
    where: { storeId, materialId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const balance = Number(material.balance?.quantity ?? 0);
  const reorder = material.reorderLevel ? Number(material.reorderLevel) : null;
  const isLow = reorder !== null && balance < reorder;

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/materials"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← المواد الخام
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{material.name}</h1>
        <p className="text-sm text-gray-500">
          {material.materialType.name}
          {material.supplier ? ` · ${material.supplier.name}` : ""}
          {material.sku ? ` · SKU: ${material.sku}` : ""}
        </p>
      </div>

      {/* KPI row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="text-sm text-gray-500">الرصيد الحالي</div>
          <div
            className={`mt-2 text-2xl font-bold ${isLow ? "text-red-600" : ""}`}
          >
            {balance.toFixed(2)} {material.unit}
          </div>
          {isLow && (
            <div className="mt-1 text-xs text-red-500">
              أقل من حد إعادة الطلب ({reorder?.toFixed(2)} {material.unit})
            </div>
          )}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="text-sm text-gray-500">التكلفة الافتراضية</div>
          <div className="mt-2 text-2xl font-bold">
            {material.defaultCost !== null
              ? `${Number(material.defaultCost).toFixed(2)} EGP`
              : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="text-sm text-gray-500">السعة</div>
          <div className="mt-2 text-2xl font-bold">
            {material.capacityMl !== null
              ? `${Number(material.capacityMl)} ml`
              : "—"}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Adjustment form */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <h2 className="mb-4 font-semibold">تسوية المخزون</h2>
          <AdjustInventoryForm
            materialId={material.id}
            materialName={material.name}
            unit={material.unit}
            currentBalance={balance}
          />
        </div>

        {/* History */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <h2 className="mb-4 font-semibold">سجل الحركات</h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400">لا توجد حركات بعد</p>
          ) : (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 400 }}>
              {history.map((txn) => {
                const isIn = [
                  "ADJUSTMENT_IN",
                  "PURCHASE",
                  "RETURN_RESTOCK",
                  "OPENING",
                ].includes(txn.type);
                return (
                  <div
                    key={txn.id}
                    className="flex items-start justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {txTypeLabels[txn.type] ?? txn.type}
                      </div>
                      {txn.reason && (
                        <div className="text-xs text-gray-500">{txn.reason}</div>
                      )}
                      <div className="text-xs text-gray-400">
                        {new Date(txn.createdAt).toLocaleString("ar-EG")}
                      </div>
                    </div>
                    <div
                      className={`font-mono font-semibold ${isIn ? "text-green-600" : "text-red-600"}`}
                    >
                      {isIn ? "+" : "−"}
                      {Number(txn.quantity).toFixed(2)} {txn.unit}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
