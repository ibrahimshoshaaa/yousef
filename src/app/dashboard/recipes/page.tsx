import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { Suspense } from "react";
import Link from "next/link";
import { listRecipes, currentVersionOf, getRecipeVersionCost } from "@/services/recipe.service";
import { isCostingEnabled } from "@/lib/settings";

async function getDevStoreId() {
  const session = await requireAuth();
  if (!can(session.role, "recipes.read")) throw new Error("Forbidden");
  return session.storeId;
}

async function RecipesTable({ storeId }: { storeId: string }) {
  const [recipes, costingEnabled] = await Promise.all([
    listRecipes(storeId),
    isCostingEnabled(storeId),
  ]);

  if (recipes.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-gray-400">
        لا توجد وصفات بعد — أنشئ أول وصفة
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-gray-50 text-right text-xs text-gray-500">
            <th className="px-4 py-3">الوصفة</th>
            <th className="px-4 py-3">المنتج</th>
            <th className="px-4 py-3">المتغير</th>
            <th className="px-4 py-3 text-center">النسخة الحالية</th>
            <th className="px-4 py-3">عدد المواد</th>
            {costingEnabled && <th className="px-4 py-3 text-center">التكلفة التقديرية</th>}
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {await Promise.all(
            recipes.map(async (r) => {
              const current = currentVersionOf(r);
              const cost =
                costingEnabled && current
                  ? await getRecipeVersionCost(storeId, current.id)
                  : null;

              return (
                <tr
                  key={r.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500">{r.variant.product.title}</td>
                  <td className="px-4 py-3 text-gray-500">{r.variant.title}</td>
                  <td className="px-4 py-3 text-center">
                    {current ? `v${current.version}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {current?.items.length ?? 0}
                  </td>
                  {costingEnabled && (
                    <td className="px-4 py-3 text-center font-mono">
                      {cost ? `${cost.total.toFixed(2)}${cost.complete ? "" : "*"}` : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-left">
                    <Link
                      href={`/dashboard/recipes/${r.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      تفاصيل
                    </Link>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function RecipesPage() {
  const storeId = await getDevStoreId();

  return (
    <div className="p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">المخزون</p>
          <h1 className="mt-1 text-2xl font-bold">الوصفات</h1>
        </div>
        <Link
          href="/dashboard/recipes/new"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + إنشاء وصفة
        </Link>
      </header>

      {storeId ? (
        <Suspense
          fallback={<div className="h-48 animate-pulse rounded-xl bg-gray-100" />}
        >
          <RecipesTable storeId={storeId} />
        </Suspense>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-gray-400">
          لم يتم إنشاء متجر بعد
        </div>
      )}
    </div>
  );
}
