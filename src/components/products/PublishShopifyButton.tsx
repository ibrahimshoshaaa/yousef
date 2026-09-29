"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PublishShopifyButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function publish() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/publish-shopify`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر نشر المنتج");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر نشر المنتج");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-2">
    <button type="button" disabled={busy} onClick={publish} className="rounded-xl bg-[#191735] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "جارٍ النشر..." : "نشر المنتج في Shopify"}</button>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>;
}
