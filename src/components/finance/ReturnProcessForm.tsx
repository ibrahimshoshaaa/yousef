"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Item = { id: string; title: string; quantity: number };
export function ReturnProcessForm({ returnId, items }: { returnId: string; items: Item[] }) {
  const router = useRouter();
  const [decisions, setDecisions] = useState(items.map(i => ({ id: i.id, condition: "UNKNOWN", restock: false })));
  const [cost, setCost] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch(`/api/returns/${returnId}/process`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: decisions, ...(cost === "" ? {} : { returnCost: Number(cost) }) }) });
      const body = await res.json(); if (!res.ok) throw new Error(body.error || "تعذر حفظ المرتجع"); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "حدث خطأ"); } finally { setBusy(false); }
  }
  return <div className="space-y-3 border-t p-4">
    {items.map((item, index) => <div key={item.id} className="flex flex-wrap items-center gap-3 text-sm"><span>{item.title} × {item.quantity}</span><select aria-label={`حالة ${item.title}`} className="rounded border p-2" value={decisions[index].condition} onChange={e => setDecisions(old => old.map((d, j) => j === index ? { ...d, condition: e.target.value, restock: false } : d))}><option value="UNKNOWN">غير محدد</option><option value="GOOD">جيد</option><option value="DAMAGED">تالف</option><option value="OPENED">مفتوح</option><option value="UNSELLABLE">غير قابل للبيع</option></select><label><input type="checkbox" checked={decisions[index].restock} disabled={decisions[index].condition !== "GOOD"} onChange={e => setDecisions(old => old.map((d, j) => j === index ? { ...d, restock: e.target.checked } : d))} /> إعادة مكونات الوصفة للمخزون</label></div>)}
    <label className="block text-sm">تكلفة المرتجع (اتركها فارغة للقيمة الافتراضية) <input className="ml-2 w-28 rounded border p-2" type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} /></label>
    <button className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" disabled={busy || decisions.some(d => d.condition === "UNKNOWN")} onClick={submit}>اعتماد المرتجع</button>{message && <p role="alert" className="text-red-700">{message}</p>}
  </div>;
}
