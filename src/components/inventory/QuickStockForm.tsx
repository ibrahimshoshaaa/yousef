"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

type Category = { id: string; name: string };
const defaults: Category[] = [
  { id: "OILS", name: "زيوت" }, { id: "BOTTLES", name: "زجاجات" },
  { id: "BOXES", name: "بوكسات التغليف" }, { id: "TESTERS", name: "زجاجات تيستر" },
];

export function QuickStockForm({ extraCategories }: { extraCategories: Category[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef<string | null>(null);
  const [categories, setCategories] = useState([...defaults, ...extraCategories]);
  const [category, setCategory] = useState("OILS");
  const [unit, setUnit] = useState<"مل" | "قطعة">("قطعة");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const currentUnit = category === "OILS" ? "مل" : category.startsWith("type:") ? unit : "قطعة";
  const inputClass = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-[#96723c]";

  async function addCategory() {
    if (!newCategory.trim()) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/material-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategory.trim() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذر إضافة النوع");
      const id = `type:${body.data.id}`;
      setCategories((current) => [...current, { id, name: body.data.name }]);
      setCategory(id); setNewCategory(""); setShowNewCategory(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر إضافة النوع"); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/inventory/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: requestId.current, category, name: name.trim(), quantity: Number(quantity), amount: Number(amount), unit: currentUnit }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذر حفظ المخزون");
      requestId.current = null;
      setName(""); setQuantity(""); setAmount("");
      setNotice("تم حفظ المخزون وتسجيل سعر الشراء في المصروفات.");
      dialog.current?.close();
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حفظ المخزون"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-2">
    <button type="button" onClick={() => { setMessage(""); setNotice(""); dialog.current?.showModal(); }} className="rounded-xl bg-[#263b35] px-5 py-3 text-sm font-semibold text-white hover:bg-[#345348]">+ إضافة مخزون</button>
    {notice && <p role="status" className="max-w-xs rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    <dialog ref={dialog} dir="rtl" aria-labelledby="stock-dialog-title" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-right shadow-2xl backdrop:bg-slate-950/50">
    <section className="p-5 sm:p-7">
    <div className="flex items-start justify-between gap-4"><div>
    <h2 id="stock-dialog-title" className="text-xl font-bold text-slate-900">إضافة مخزون</h2>
    <p className="mt-1 text-sm text-slate-500">نفس اسم الخامة يزود رصيدها عند الشراء مرة ثانية. سعر الشراء يتسجل في المصروفات تلقائيًا.</p>
    </div><button type="button" aria-label="إغلاق" onClick={() => dialog.current?.close()} className="shrink-0 rounded-lg px-2 text-2xl text-slate-500 hover:bg-slate-100">×</button></div>
    {message && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-slate-800">{message}</p>}
    <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">النوع<select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-sm font-semibold">اسم الخامة<input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder={category === "OILS" ? "مثال: زيت عود" : category === "BOTTLES" ? "مثال: زجاجة ٣٠ مل" : "مثال: بوكس كرتون"} className={inputClass} /></label>
      {category.startsWith("type:") && <label className="text-sm font-semibold">وحدة المخزون<select value={unit} onChange={(event) => setUnit(event.target.value as "مل" | "قطعة")} className={inputClass}><option value="قطعة">قطعة</option><option value="مل">مل</option></select></label>}
      <label className="text-sm font-semibold">الكمية ({currentUnit})<input required type="number" inputMode="decimal" min={currentUnit === "قطعة" ? "1" : "0.000001"} step={currentUnit === "قطعة" ? "1" : "any"} value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="مثال: ١٠٠٠" className={inputClass} /></label>
      <label className="text-sm font-semibold">سعر الكمية كلها (جنيه)<input required type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="مثال: ٥٠٠٠" className={inputClass} /></label>
      <div className="flex items-end"><button type="submit" disabled={busy} className="w-full rounded-xl bg-[#263b35] px-5 py-3.5 font-semibold text-white disabled:opacity-50">{busy ? "جارٍ الحفظ..." : "حفظ المخزون"}</button></div>
    </form>
    <button type="button" onClick={() => setShowNewCategory((current) => !current)} className="mt-5 text-sm font-semibold text-[#315b4c] underline">+ إضافة نوع جديد غير الأربعة</button>
    {showNewCategory && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} maxLength={100} placeholder="اسم النوع الجديد" className={inputClass} /><button type="button" onClick={addCategory} disabled={!newCategory.trim() || busy} className="rounded-xl bg-[#263b35] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">إضافة النوع</button></div>}
    </section>
    </dialog>
  </div>;
}
