"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  recipeId: string;
  versionId: string;
};

export function ActivateVersionButton({ recipeId, versionId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!confirm("تفعيل هذه النسخة كنسخة حالية للوصفة؟")) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/recipes/${recipeId}/versions/${versionId}/activate`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "حدث خطأ");
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-gray-600 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
    >
      {loading ? "..." : "تفعيل هذه النسخة"}
    </button>
  );
}
