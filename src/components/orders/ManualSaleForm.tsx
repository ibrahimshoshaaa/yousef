"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

type Variant = { id: string; label: string; price: number };
type Line = { key: number; variantId: string; quantity: string; unitPrice: string };

export function ManualSaleForm({ variants }: { variants: Variant[] }) {
  const router = useRouter();
  const nextKey = useRef(1);
  const requestId = useRef<string | null>(null);
  const [lines, setLines] = useState<Line[]>([{ key: 0, variantId: "", quantity: "1", unitPrice: "" }]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [hasDeposit, setHasDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fieldClass = "mt-2 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#96723c]";

  function update(key: number, changes: Partial<Line>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...changes } : line));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (new Set(lines.map((line) => line.variantId)).size !== lines.length) {
      setError("اختر كل حجم مرة واحدة فقط.");
      return;
    }
    setBusy(true);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/orders/manual", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current,
          customerName: customerName.trim(), customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim(), hasDeposit, depositAmount: hasDeposit ? Number(depositAmount) : 0,
          items: lines.map((line) => ({ variantId: line.variantId, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر حفظ البيع");
      requestId.current = null;
      window.dispatchEvent(new Event("dashboard-navigation-start"));
      router.push(`/dashboard/orders?manual=created`);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "تعذر حفظ البيع");
      setBusy(false);
    }
  }

  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);

  return <form onSubmit={submit} className="space-y-6">
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {!variants.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">أضف منتجًا وحجمًا قبل تسجيل البيع. <Link href="/dashboard/products/new" className="font-semibold underline">إضافة منتج</Link></div>}
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-semibold">المنتجات المباعة</h2>
      {lines.map((line, index) => <div key={line.key} className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_100px_130px]">
        <label className="text-sm font-medium text-slate-700">المنتج والحجم *<select required value={line.variantId} onChange={(event) => {
          const variant = variants.find((option) => option.id === event.target.value);
          update(line.key, { variantId: event.target.value, unitPrice: variant ? String(variant.price) : "" });
        }} className={fieldClass}><option value="">اختر المنتج</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">العدد *<input required type="number" inputMode="numeric" min="1" max="10000" step="1" value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })} className={fieldClass} /></label>
        <label className="text-sm font-medium text-slate-700">سعر القطعة *<input required type="number" inputMode="decimal" min="0" max="1000000" step="0.01" value={line.unitPrice} onChange={(event) => update(line.key, { unitPrice: event.target.value })} className={fieldClass} /></label>
        {lines.length > 1 && <button type="button" onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))} className="text-right text-sm font-medium text-red-700 sm:col-span-3">إزالة الصنف {index + 1}</button>}
      </div>)}
      <button type="button" onClick={() => setLines((current) => [...current, { key: nextKey.current++, variantId: "", quantity: "1", unitPrice: "" }])} disabled={busy || lines.length >= 30} className="rounded-xl border border-[#263b35] px-4 py-2.5 text-sm font-semibold text-[#263b35] disabled:opacity-50">+ إضافة صنف آخر</button>
    </section>
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div><h2 className="text-lg font-semibold">بيانات العميل والتوصيل</h2><p className="mt-1 text-sm text-slate-500">احتفظ ببيانات التواصل والشحن مع الطلب.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">اسم العميل *<input required maxLength={100} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="اسم العميل" className={fieldClass} /></label>
        <label className="text-sm font-medium text-slate-700">رقم الهاتف *<input required type="tel" minLength={7} maxLength={30} value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="رقم للتواصل" className={fieldClass} /></label>
      </div>
      <label className="block text-sm font-medium text-slate-700">عنوان التوصيل *<textarea required minLength={5} maxLength={500} rows={3} value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} placeholder="المحافظة، المنطقة، الشارع والعلامة المميزة" className={fieldClass} /></label>
      <div className="rounded-xl bg-slate-50 p-4"><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={hasDeposit} onChange={(event) => { setHasDeposit(event.target.checked); if (!event.target.checked) setDepositAmount(""); }} /> دفع ديبوزت</label>{hasDeposit && <label className="mt-3 block text-sm font-medium text-slate-700">قيمة الديبوزت (EGP) *<input required type="number" min="0.01" max={Math.max(0, total - 0.01).toFixed(2)} step="0.01" inputMode="decimal" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} className={fieldClass} /></label>}</div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5"><div><p className="text-sm text-slate-500">إجمالي الطلب</p><strong className="text-2xl text-slate-900">{total.toFixed(2)} EGP</strong><p className="mt-1 text-sm text-slate-500">المتبقي عند التسليم: {Math.max(0, total - (hasDeposit ? Number(depositAmount) || 0 : 0)).toFixed(2)} EGP</p></div><button type="submit" disabled={busy || !variants.length || total <= 0} className="w-full rounded-xl bg-[#263b35] px-6 py-3.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">{busy ? "جارٍ تسجيل الطلب..." : "تأكيد الطلب"}</button></div>
      <p className="text-xs leading-6 text-slate-500">يبدأ الطلب «قيد التجهيز» بدون اعتباره مدفوعًا بالكامل. عند وضعه «تم التجهيز» تُخصم خامات الوصفة، وبعد تسليمه للعميل يُحدّث إلى «تم التسليم» ومدفوع.</p>
    </section>
  </form>;
}
