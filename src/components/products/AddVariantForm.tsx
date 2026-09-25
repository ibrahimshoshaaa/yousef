"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { productId: string };

export function AddVariantForm({ productId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("اسم المتغير مطلوب (مثال: 50 مل)");
      return;
    }
    if (!price || isNaN(parseFloat(price))) {
      setError("السعر مطلوب");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sku: sku.trim() || null,
          price: parseFloat(price),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "حدث خطأ");
      }

      setTitle("");
      setSku("");
      setPrice("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        + إضافة متغير (حجم)
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--border)] bg-gray-50 p-3"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          العنوان
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثال: 50 مل"
          className="w-32 rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          SKU
        </label>
        <input
          type="text"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="اختياري"
          className="w-32 rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          السعر (EGP)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-28 rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-gray-600 hover:bg-white"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "..." : "حفظ"}
        </button>
      </div>
    </form>
  );
}
