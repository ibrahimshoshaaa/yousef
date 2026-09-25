"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialTypeCreator } from "./MaterialTypeCreator";

type MaterialType = { id: string; name: string; code: string };
type Supplier = { id: string; name: string };

type Props = {
  types: MaterialType[];
  suppliers: Supplier[];
  storeId: string;
};

export function NewMaterialForm({ types, suppliers }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTypes, setAvailableTypes] = useState(types);

  const [form, setForm] = useState({
    materialTypeId: "",
    supplierId: "",
    name: "",
    sku: "",
    unit: "",
    baseUnit: "",
    description: "",
    capacityMl: "",
    defaultCost: "",
    reorderLevel: "",
  });

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.materialTypeId) {
      setError("اختر نوع المادة");
      return;
    }
    if (!form.name.trim()) {
      setError("اسم المادة مطلوب");
      return;
    }
    if (!form.unit.trim()) {
      setError("الوحدة مطلوبة");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialTypeId: form.materialTypeId,
          supplierId: form.supplierId || null,
          name: form.name.trim(),
          sku: form.sku.trim() || null,
          unit: form.unit.trim(),
          baseUnit: form.baseUnit.trim() || form.unit.trim(),
          description: form.description.trim() || null,
          capacityMl: form.capacityMl ? parseFloat(form.capacityMl) : null,
          defaultCost: form.defaultCost ? parseFloat(form.defaultCost) : null,
          reorderLevel: form.reorderLevel
            ? parseFloat(form.reorderLevel)
            : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "حدث خطأ");
      }

      const { data } = await res.json();
      router.push(`/dashboard/materials/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  const field = (
    label: string,
    key: keyof typeof form,
    opts: {
      type?: string;
      placeholder?: string;
      required?: boolean;
      min?: string;
      step?: string;
    } = {}
  ) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label} {opts.required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={opts.type ?? "text"}
        placeholder={opts.placeholder}
        min={opts.min}
        step={opts.step}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          نوع المادة <span className="text-red-500">*</span>
        </label>
        <select
          value={form.materialTypeId}
          onChange={(e) => set("materialTypeId", e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="">اختر النوع...</option>
          {availableTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {availableTypes.length === 0 && <p className="mt-2 text-sm text-amber-700">أضف نوع مادة أولًا للمتابعة.</p>}
        <MaterialTypeCreator onCreated={(type) => {
          setAvailableTypes((current) => [...current, type].sort((a, b) => a.name.localeCompare(b.name, "ar")));
          set("materialTypeId", type.id);
        }} />
      </div>

      {field("اسم المادة", "name", { required: true, placeholder: "مثال: عود النور 3 مل" })}

      <div className="grid grid-cols-2 gap-3">
        {field("وحدة العرض", "unit", { required: true, placeholder: "مثال: مل، قطعة، كيس" })}
        {field("الوحدة الأساسية", "baseUnit", { placeholder: "اتركه فارغًا = نفس الوحدة" })}
      </div>

      {field("SKU / كود", "sku", { placeholder: "اختياري" })}

      {/* Supplier */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          المورد (اختياري)
        </label>
        <select
          value={form.supplierId}
          onChange={(e) => set("supplierId", e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="">بدون مورد</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {field("التكلفة الافتراضية (EGP)", "defaultCost", {
          type: "number",
          min: "0",
          step: "0.01",
          placeholder: "0.00",
        })}
        {field("حد إعادة الطلب", "reorderLevel", {
          type: "number",
          min: "0",
          step: "0.001",
          placeholder: "0",
        })}
      </div>

      {field("السعة (ml) — للزجاجات والزيوت", "capacityMl", {
        type: "number",
        min: "0",
        step: "0.1",
        placeholder: "اختياري",
      })}

      {field("وصف", "description", { placeholder: "اختياري" })}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
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
          {loading ? "جاري الحفظ..." : "حفظ المادة"}
        </button>
      </div>
    </form>
  );
}
