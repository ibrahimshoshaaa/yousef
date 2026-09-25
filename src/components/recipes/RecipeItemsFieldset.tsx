"use client";

type Material = { id: string; name: string; unit: string };

export type RecipeItemRow = {
  materialId: string;
  quantity: string;
  unit: string;
};

type Props = {
  materials: Material[];
  rows: RecipeItemRow[];
  onChange: (rows: RecipeItemRow[]) => void;
};

export function emptyRow(): RecipeItemRow {
  return { materialId: "", quantity: "", unit: "" };
}

export function RecipeItemsFieldset({ materials, rows, onChange }: Props) {
  function updateRow(index: number, patch: Partial<RecipeItemRow>) {
    const next = rows.map((row, i) => {
      if (i !== index) return row;
      const merged = { ...row, ...patch };
      // Default the unit to the material's own unit when first picked.
      if (patch.materialId) {
        const material = materials.find((m) => m.id === patch.materialId);
        if (material && !row.unit) merged.unit = material.unit;
      }
      return merged;
    });
    onChange(next);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-600">
        المواد الداخلة في الوصفة <span className="text-red-500">*</span>
      </label>

      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <select
            value={row.materialId}
            onChange={(e) => updateRow(index, { materialId: e.target.value })}
            className="min-w-0 flex-[2] rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">اختر المادة...</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0.001"
            step="0.001"
            placeholder="الكمية"
            value={row.quantity}
            onChange={(e) => updateRow(index, { quantity: e.target.value })}
            className="w-24 flex-none rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <input
            type="text"
            placeholder="الوحدة"
            value={row.unit}
            onChange={(e) => updateRow(index, { unit: e.target.value })}
            className="w-20 flex-none rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={() => removeRow(index)}
            className="flex-none rounded-lg border border-[var(--border)] px-2 py-2 text-sm text-gray-400 hover:bg-gray-50 hover:text-red-600"
            aria-label="حذف السطر"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...rows, emptyRow()])}
        className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        + إضافة مادة
      </button>
    </div>
  );
}
