"use client";

import { useState } from "react";

export function ConnectShopifyForm() {
  const [shop, setShop] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = shop.trim().toLowerCase();
    const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;

    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
      setError("أدخل نطاق متجر Shopify صحيح، مثال: my-store.myshopify.com");
      return;
    }

    setLoading(true);
    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(domain)}`;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          نطاق متجر Shopify
        </label>
        <input
          type="text"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          placeholder="my-store.myshopify.com"
          dir="ltr"
          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "جاري التحويل إلى Shopify..." : "ربط المتجر"}
      </button>
    </form>
  );
}
