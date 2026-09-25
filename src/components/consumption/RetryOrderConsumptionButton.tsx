"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetryOrderConsumptionButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/consume`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشلت إعادة المعالجة");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleRetry}
        disabled={loading}
        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-gray-600 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
      >
        {loading ? "...جارٍ إعادة المعالجة" : "إعادة معالجة الطلب"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
