"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

type Material = { id: string; name: string; unit: string; category: string };
type Line = { key: number; materialId: string; quantity: string };

export function SimpleProductForm({ materials }: { materials: Material[] }) {
  const router = useRouter();
  const nextKey = useRef(1);
  const requestId = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: 0, materialId: "", quantity: "" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputClass = "mt-2 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-[#96723c]";
  function update(key: number, changes: Partial<Line>) { setLines((current) => current.map((line) => line.key === key ? { ...line, ...changes } : line)); }
  function addMaterial(material: Material) {
    setLines((current) => {
      if (current.some((line) => line.materialId === material.id)) return current;
      const next = { materialId: material.id, quantity: material.unit.toLowerCase() === "ml" ? "" : "1" };
      const empty = current.find((line) => !line.materialId);
      return empty ? current.map((line) => line.key === empty.key ? { ...line, ...next } : line)
        : current.length < 30 ? [...current, { key: nextKey.current++, ...next }] : current;
    });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    if (new Set(lines.map((line) => line.materialId)).size !== lines.length) { setError("اختار كل خامة مرة واحدة فقط."); setBusy(false); return; }
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/products/simple", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: requestId.current, name: name.trim(), price: Number(price), materials: lines.map((line) => ({ materialId: line.materialId, quantity: Number(line.quantity) })) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذر حفظ المنتج");
      requestId.current = null;
      window.dispatchEvent(new Event("dashboard-navigation-start"));
      router.push(`/dashboard/products/${body.data.productId}`); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "تعذر حفظ المنتج"); setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <label className="block text-sm font-semibold">اسم العطر وحجمه<input required value={name} onChange={(event) => setName(event.target.value)} maxLength={200} placeholder="مثال: عطر عود ٣٠ مل" className={inputClass} /></label>
    <label className="block text-sm font-semibold">سعر بيع العطر (جنيه)<input required type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} /></label>
    <div><h2 className="text-lg font-bold">الخامات المستخدمة في العطر الواحد</h2><p className="mt-1 text-sm text-slate-500">اضغط على الخامة لإضافتها، ثم حدد الكمية التي تُخصم عند بيع قطعة واحدة.</p></div>
    {!materials.length && <p className="rounded-xl bg-amber-50 p-4 text-sm">أضف خاماتك من <Link href="/dashboard/inventory" className="font-semibold underline">المخزون</Link> أولًا.</p>}
    {!!materials.length && <div className="space-y-3 rounded-2xl border border-[#e5e4ec] bg-[#f7f7fb] p-4">
      <p className="text-sm font-semibold text-[#191735]">إضافة سريعة من المخزون</p>
      {[...new Set(materials.map((material) => material.category))].map((category) => <div key={category}>
        <p className="mb-2 text-xs font-semibold text-slate-500">{category}</p>
        <div className="flex flex-wrap gap-2">{materials.filter((material) => material.category === category).map((material) => <button key={material.id} type="button" disabled={busy || lines.some((line) => line.materialId === material.id) || lines.length >= 30 && !lines.some((line) => !line.materialId)} onClick={() => addMaterial(material)} className="rounded-full border border-[#d7d6e2] bg-white px-3 py-2 text-sm text-[#191735] disabled:bg-[#e7e6ee] disabled:text-slate-500">{lines.some((line) => line.materialId === material.id) ? "✓ " : "+ "}{material.name} · {material.unit}</button>)}</div>
      </div>)}
    </div>}
    {lines.map((line) => {
      const selected = materials.find((material) => material.id === line.materialId);
      return <div key={line.key} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end">
        <label className="text-sm font-semibold">الخامة<select required value={line.materialId} onChange={(event) => { const material = materials.find((item) => item.id === event.target.value); update(line.key, { materialId: event.target.value, quantity: material?.unit.toLowerCase() === "ml" ? "" : line.quantity || "1" }); }} className={inputClass}><option value="">اختر خامة</option>{[...new Set(materials.map((material) => material.category))].map((category) => <optgroup key={category} label={category}>{materials.filter((material) => material.category === category && (!lines.some((entry) => entry.key !== line.key && entry.materialId === material.id))).map((material) => <option key={material.id} value={material.id}>{material.name} ({material.unit})</option>)}</optgroup>)}</select></label>
        <label className="text-sm font-semibold">الكمية ({selected?.unit || "الوحدة"})<input required type="number" min="0.000001" step="any" inputMode="decimal" value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })} className={inputClass} /></label>
        {lines.length > 1 && <button type="button" onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))} className="rounded-lg border border-red-200 px-3 py-3 text-sm text-red-700">حذف</button>}
      </div>;
    })}
    <button type="button" disabled={lines.length >= 30} onClick={() => setLines((current) => [...current, { key: nextKey.current++, materialId: "", quantity: "" }])} className="rounded-xl border border-[#191735] px-4 py-3 text-sm font-semibold text-[#191735]">+ خامة أخرى</button>
    <div className="border-t border-slate-100 pt-5"><button type="submit" disabled={busy || !materials.length} className="w-full rounded-xl bg-[#191735] px-6 py-3.5 font-semibold text-white disabled:opacity-50">{busy ? "جارٍ الحفظ..." : "حفظ العطر وخاماته"}</button></div>
  </form>;
}
