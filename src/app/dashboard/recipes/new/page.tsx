import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import Link from "next/link";
import { db } from "@/lib/db";
import { listUnmappedVariants } from "@/services/product.service";
import { CreateRecipeForm } from "@/components/recipes/CreateRecipeForm";

async function getDevStoreId() {
  const session = await requireAuth();
  if (!can(session.role, "recipes.read")) throw new Error("Forbidden");
  return session.storeId;
}

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ variantId?: string }>;
}) {
  const { variantId } = await searchParams;
  const storeId = await getDevStoreId();

  const [unmappedVariants, materials] = storeId
    ? await Promise.all([
        listUnmappedVariants(storeId),
        db.material.findMany({
          where: { storeId, active: true },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];

  // Only honour ?variantId= when that variant genuinely has no recipe yet —
  // otherwise fall back to a plain picker rather than risk a duplicate.
  const preselectedVariantId = unmappedVariants.some((v) => v.id === variantId)
    ? variantId
    : undefined;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <Link
          href="/dashboard/recipes"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← الوصفات
        </Link>
        <h1 className="mt-2 text-2xl font-bold">إنشاء وصفة جديدة</h1>
      </div>

      <div className="mx-auto max-w-2xl rounded-xl border border-[var(--border)] bg-white p-6">
        <CreateRecipeForm
          variants={unmappedVariants}
          materials={materials}
          preselectedVariantId={preselectedVariantId}
        />
      </div>
    </div>
  );
}
