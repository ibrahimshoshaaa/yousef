"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RecipeItemsFieldset,
  emptyRow,
  type RecipeItemRow,
} from "@/components/recipes/RecipeItemsFieldset";

type Material = { id: string; name: string; unit: string };

type Props = {
  recipeId: string;
  materials: Material[];
  initialRows?: RecipeItemRow[];
};

export function NewVersionForm({ recipeId, materials, initialRows }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<RecipeItemRow[]>(
    initialRows && initialRows.length > 0 ? initialRows : [emptyRow()]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const items = rows.filter((r) => r.materialId && r.quantity);
    if (items.length === 0) {
      setError("أضف مادة واحدة على الأقل بكمية صحيحة");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-gray-500">
        سيتم إنشاء نسخة جديدة من الوصفة وتفعيلها. النسخة الحالية تبقى محفوظة
        في السجل ولن يتم تعديلها.
      </p>

      <RecipeItemsFieldset materials={materials} rows={rows} onChange={setRows} />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "جاري الحفظ..." : "إنشاء نسخة جديدة وتفعيلها"}
      </button>
    </form>
  );
}
