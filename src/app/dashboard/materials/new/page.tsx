import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import Link from "next/link";
import { db } from "@/lib/db";
import { NewMaterialForm } from "@/components/materials/NewMaterialForm";

async function getDevStoreId() {
  const session = await requireAuth();
  if (!can(session.role, "materials.read")) throw new Error("Forbidden");
  return session.storeId;
}

export default async function NewMaterialPage() {
  const storeId = await getDevStoreId();

  const [types, suppliers] = storeId
    ? await Promise.all([
        db.materialType.findMany({
          where: { storeId, active: true },
          orderBy: { name: "asc" },
        }),
        db.supplier.findMany({
          where: { storeId, active: true },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <Link
          href="/dashboard/materials"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← المواد الخام
        </Link>
        <h1 className="mt-2 text-2xl font-bold">إضافة مادة جديدة</h1>
      </div>

      <div className="mx-auto max-w-2xl rounded-xl border border-[var(--border)] bg-white p-6">
        <NewMaterialForm
          types={types}
          suppliers={suppliers}
          storeId={storeId ?? ""}
        />
      </div>
    </div>
  );
}
