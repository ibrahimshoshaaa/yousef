"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RecipeItemsFieldset,
  emptyRow,
  type RecipeItemRow,
} from "@/components/recipes/RecipeItemsFieldset";

type Variant = {
  id: string;
  title: string;
  sku: string | null;
  product: { title: string };
};
type Material = { id: string; name: string; unit: string };

type Props = {
  variants: Variant[];
  materials: Material[];
  preselectedVariantId?: string;
};

export function CreateRecipeForm({ variants, materials, preselectedVariantId }: Props) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(preselectedVariantId ?? "");
  const [name, setName] = useState("");
  const [rows, setRows] = useState<RecipeItemRow[]>([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!variantId) {
      setError("اختر المتغير (الحجم) المرتبط بالوصفة");
      return;
    }
    if (!name.trim()) {
      setError("اسم الوصفة مطلوب");
      return;
    }
    const items = rows.filter((r) => r.materialId && r.quantity);
    if (items.length === 0) {
      setError("أضف مادة واحدة على الأقل بكمية صحيحة");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId,
          name: name.trim(),
          items: items.map((r) => ({
            materialId: r.materialId,
            quantity: parseFloat(r.quantity),
            unit: r.unit.trim(),
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "حدث خطأ");
      }

      const { data } = await res.json();
      router.push(`/dashboard/recipes/${data.recipe.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          المتغير (المنتج/الحجم) <span className="text-red-500">*</span>
        </label>
        <select
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          disabled={Boolean(preselectedVariantId)}
          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] disabled:bg-gray-50"
        >
          <option value="">اختر متغيرًا بدون وصفة...</option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.product.title} — {v.title}
              {v.sku ? ` (${v.sku})` : ""}
            </option>
          ))}
        </select>
        {variants.length === 0 && !preselectedVariantId && (
          <p className="mt-1 text-xs text-amber-600">
            كل المتغيرات مرتبطة بوصفة بالفعل، أو لا توجد منتجات بعد
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          اسم الوصفة <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: بلو عود 50 مل"
          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>

      <RecipeItemsFieldset materials={materials} rows={rows} onChange={setRows} />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "جاري الحفظ..." : "حفظ الوصفة"}
        </button>
      </div>
    </form>
  );
}
