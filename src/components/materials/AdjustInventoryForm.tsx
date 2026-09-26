"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  materialId: string;
  materialName: string;
  unit: string;
  currentBalance: number;
};

export function AdjustInventoryForm({
  materialId,
  materialName,
  unit,
  currentBalance,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"add" | "subtract" | "set">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const computedQuantity = () => {
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) return null;
    if (mode === "add") return n;
    if (mode === "subtract") return -n;
    if (mode === "set") return n - currentBalance;
    return null;
  };

  const preview = computedQuantity();
  const newBalance = preview !== null ? currentBalance + preview : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const qty = computedQuantity();
    if (qty === null || qty === 0) {
      setError("الكمية يجب ألا تكون صفرًا");
      return;
    }
    if (!reason.trim()) {
      setError("السبب مطلوب");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId,
          quantity: qty,
          reason: reason.trim(),
          note: note.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "حدث خطأ");
      }

      setSuccess("تم تحديث المخزون بنجاح");
      setAmount("");
      setReason("");
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode selector */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          نوع التسوية — {materialName}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["add", "إضافة"],
              ["subtract", "خصم"],
              ["set", "تحديد الرصيد"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setMode(val)}
              className={`min-h-11 rounded-xl border px-1 py-2 text-xs font-semibold sm:text-sm transition ${
                mode === val
                  ? "border-[#263b35] bg-[#263b35] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          الكمية ({unit})
        </label>
        <input
          type="number"
          min="0.001"
          step="0.001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.000"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#315b4c]"
        />
        {newBalance !== null && (
          <p className="mt-1 text-xs text-gray-500">
            الرصيد الجديد:{" "}
            <span className="font-semibold">
              {newBalance.toFixed(2)} {unit}
            </span>
          </p>
        )}
      </div>

      {/* Reason */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          السبب *
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="مثال: شراء جديد، تصحيح جرد..."
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#315b4c]"
        />
      </div>

      {/* Note */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          ملاحظة (اختياري)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#315b4c] resize-none"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[#263b35] px-4 py-3 text-sm font-semibold text-white hover:bg-[#345348] disabled:opacity-50"
      >
        {loading ? "جاري الحفظ..." : "تأكيد التسوية"}
      </button>
    </form>
  );
}
