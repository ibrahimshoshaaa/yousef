"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ManualOrderStatus } from "@/services/manual-order.service";

const nextStatus: Partial<Record<ManualOrderStatus, { status: ManualOrderStatus; label: string }>> = {
  NEW: { status: "PREPARED", label: "تم التجهيز" },
  PREPARED: { status: "SHIPPING", label: "جاري الشحن" },
  SHIPPING: { status: "DELIVERED", label: "تم التسليم واستلام المبلغ" },
};

export function ManualOrderActions({ orderId, status, canReturn }: { orderId: string; status: ManualOrderStatus; canReturn: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [error, setError] = useState("");
  const next = nextStatus[status];

  async function update(nextState: ManualOrderStatus) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/manual-status`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextState }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذر تحديث الطلب");
      setConfirmReturn(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحديث الطلب");
    } finally {
      setBusy(false);
    }
  }

  if (status === "RETURNED") return <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">تمت معالجة المرتجع وتسجيل تكلفته في المصروفات.</p>;
  return <div className="space-y-3 border-t border-slate-100 pt-4">
    <div className="flex flex-wrap gap-2">
      {next && <button type="button" disabled={busy} onClick={() => update(next.status)} className="rounded-xl bg-[#263b35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "جارٍ التحديث..." : next.label}</button>}
      {canReturn && (status === "SHIPPING" || status === "DELIVERED") && <button type="button" disabled={busy} onClick={() => setConfirmReturn(true)} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">تم الإرجاع</button>}
    </div>
    {confirmReturn && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p>سيُلغى صافي البيع، وتُعاد خامات الوصفات المخصومة للمخزون، ويُسجَّل مصروف مرتجع ٩٥ جنيهًا. لو كان العميل دفع ديبوزت أو استلم الطلب، تأكد من تسوية المبلغ معه خارج النظام.</p><div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => update("RETURNED")} className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "جارٍ المعالجة..." : "تأكيد الإرجاع"}</button><button type="button" disabled={busy} onClick={() => setConfirmReturn(false)} className="rounded-lg border border-slate-300 px-4 py-2">إلغاء</button></div></div>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>;
}
