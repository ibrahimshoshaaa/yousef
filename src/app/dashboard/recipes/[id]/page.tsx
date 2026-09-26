import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  getRecipe,
  currentVersionOf,
  getRecipeVersionCost,
} from "@/services/recipe.service";
import { isCostingEnabled } from "@/lib/settings";
import { NewVersionForm } from "@/components/recipes/NewVersionForm";
import { ActivateVersionButton } from "@/components/recipes/ActivateVersionButton";
import type { RecipeItemRow } from "@/components/recipes/RecipeItemsFieldset";

async function getDevStoreId() {
  const session = await requireAuth();
  if (!can(session.role, "recipes.read")) throw new Error("Forbidden");
  return session.storeId;
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await getDevStoreId();
  if (!storeId) notFound();

  const recipe = await getRecipe(storeId, id);
  if (!recipe) notFound();

  const [materials, costingEnabled] = await Promise.all([
    db.material.findMany({ where: { storeId, active: true }, orderBy: { name: "asc" } }),
    isCostingEnabled(storeId),
  ]);

  const current = currentVersionOf(recipe);
  const currentCost = current ? await getRecipeVersionCost(storeId, current.id) : null;

  const initialRows: RecipeItemRow[] | undefined = current?.items.map((it) => ({
    materialId: it.materialId,
    quantity: String(Number(it.quantity)),
    unit: it.unit,
  }));

  return (
    <div className="min-w-0 p-4 md:p-8">
      <div className="mb-6">
        <Link
          href="/dashboard/recipes"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← الوصفات
        </Link>
        <h1 className="mt-2 break-words text-2xl font-bold">{recipe.name}</h1>
        <p className="break-words text-sm text-gray-500">
          {recipe.variant.product.title} — {recipe.variant.title}
        </p>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        {/* Current version */}
        <div className="min-w-0 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">
              النسخة الحالية {current ? `— v${current.version}` : ""}
            </h2>
          </div>

          {current ? (
            <>
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-right text-xs text-gray-500">
                    <th className="w-1/2 py-2">المادة</th>
                    <th className="py-2 text-center">الكمية</th>
                    {costingEnabled && <th className="py-2 text-center">التكلفة</th>}
                  </tr>
                </thead>
                <tbody>
                  {current.items.map((item) => {
                    const line = currentCost?.breakdown.find(
                      (b) => b.materialId === item.materialId
                    );
                    const hasCost = line !== undefined && line.unitCost !== null;
                    return (
                      <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="break-words py-2">{item.material.name}</td>
                        <td className="break-words py-2 text-center font-mono">
                          {Number(item.quantity)} {item.unit}
                        </td>
                        {costingEnabled && (
                          <td className="break-words py-2 text-center font-mono">
                            {hasCost ? line.lineCost.toFixed(2) : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {costingEnabled && currentCost && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                  <span className="text-sm text-gray-500">التكلفة التقديرية الإجمالية</span>
                  <span className="font-mono font-semibold">
                    {currentCost.total.toFixed(2)} EGP
                    {!currentCost.complete && (
                      <span className="mr-1 text-xs font-normal text-amber-600">
                        (غير مكتملة — بعض المواد بدون تكلفة)
                      </span>
                    )}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">لا توجد نسخة بعد</p>
          )}
        </div>

        {/* New version form */}
        <div className="min-w-0 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-6">
          <h2 className="mb-4 font-semibold">إنشاء نسخة جديدة</h2>
          <NewVersionForm
            recipeId={recipe.id}
            materials={materials}
            initialRows={initialRows}
          />
        </div>
      </div>

      {/* Version history */}
      <div className="mt-6 min-w-0 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-6">
        <h2 className="mb-4 font-semibold">سجل النسخ</h2>
        <div className="space-y-3">
          {recipe.versions.map((v) => (
            <div key={v.id} className="min-w-0 rounded-lg border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">النسخة {v.version}</span>
                  {v.isCurrent && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      حالية
                    </span>
                  )}
                  {v.immutable && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      مؤرشفة
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(v.effectiveAt).toLocaleString("ar-EG")}
                  </span>
                </div>
                {!v.isCurrent && (
                  <ActivateVersionButton recipeId={recipe.id} versionId={v.id} />
                )}
              </div>
              <div className="mt-2 break-words text-xs text-gray-500">
                {v.items.map((it) => `${it.material.name}: ${Number(it.quantity)} ${it.unit}`).join(" · ")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
