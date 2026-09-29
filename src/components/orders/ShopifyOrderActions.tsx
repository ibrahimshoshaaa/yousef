"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Stage = "PREPARED" | "SHIPPING" | "DELIVERED";

export function ShopifyOrderActions({ orderId, stage, fulfillmentStatus, missingScopes }: {
  orderId: string; stage: string | null; fulfillmentStatus: string | null; missingScopes: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next: { status: Stage; label: string } | null = stage === "DELIVERED" ? null
    : stage === "SHIPPING" ? { status: "DELIVERED", label: "تم التسليم" }
    : stage === "PREPARED" ? { status: "SHIPPING", label: "تم الشحن" }
    : fulfillmentStatus === "UNFULFILLED" ? { status: "PREPARED", label: "تم التجهيز" } : null;

  async function update() {
    if (!next || !window.confirm(next.status === "PREPARED" ? "تأكيد تجهيز الطلب؟" :
      `سيتم تحديث Shopify أيضًا. تأكيد «${next.label}»؟`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/shopify-status`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next.status }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذر تحديث الطلب");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحديث الطلب");
    } finally { setBusy(false); }
  }

  return <div className="space-y-3 border-t border-slate-100 pt-4">
    {stage === "DELIVERED" ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">تم تسجيل تسليم الشحنة في Shopify.</p> :
      next ? <button type="button" onClick={update} disabled={busy || (next.status !== "PREPARED" && missingScopes.length > 0)}
        className="rounded-xl bg-[#263b35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "جارٍ التحديث..." : next.label}
      </button> : <p className="text-sm text-slate-500">راجع حالة الشحنة في Shopify قبل متابعة الطلب.</p>}
    {next?.status !== "PREPARED" && missingScopes.length > 0 &&
      <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">صلاحيات الشحن والتسليم غير مفعّلة للمتجر المتصل. راجع <a className="font-semibold underline" href="/dashboard/shopify">صفحة Shopify</a> لمعرفة الصلاحيات الناقصة.</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>;
}
