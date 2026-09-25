"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

type Option = { id: string; name: string };
const inputClass = "mt-2 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#96723c] focus:ring-2 focus:ring-amber-100";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0 text-sm font-medium text-slate-700">{label}{children}</label>;
}

export function ExpenseForms({ categories, materials }: { categories: Option[]; materials: Option[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryList, setCategoryList] = useState(categories);
  const [categoryKey, setCategoryKey] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>, endpoint: string) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const data: Record<string, string | number> = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    for (const key of ["amount", "quantity"]) if (key in data) data[key] = Number(data[key]);
    if ("date" in data) data.date = new Date(String(data.date)).toISOString();
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذر الحفظ");
      if (endpoint === "/api/expenses/categories") {
        setCategoryList((current) => [...current, body.data].sort((a, b) => a.name.localeCompare(b.name, "ar")));
        setCategoryKey((current) => current + 1);
      }
      form.reset();
      router.refresh();
      setMessage("تم الحفظ بنجاح");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  const buttonClass = "w-full rounded-xl bg-[#263b35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#345348] disabled:opacity-50 sm:w-auto";
  const cardClass = "min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7";

  return <div className="space-y-5">
    {message && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">{message}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <form className={cardClass} onSubmit={(event) => submit(event, "/api/expenses")}>
        <div><h2 className="text-lg font-semibold text-slate-900">تسجيل مصروف</h2><p className="mt-1 text-sm text-slate-500">سجّل قيمة المصروف وتاريخه ضمن الفئة المناسبة.</p></div>
        <Field label="الفئة *"><select key={categoryKey} required name="categoryId" className={inputClass} defaultValue=""><option value="" disabled>اختر الفئة</option>{categoryList.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        {categoryList.length === 0 && <p className="text-sm text-amber-700">أضف فئة مصروفات من القسم أدناه أولًا.</p>}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="المبلغ (EGP) *"><input required name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" className={inputClass} /></Field><Field label="التاريخ *"><input required name="date" type="date" defaultValue={new Date().toLocaleDateString("en-CA")} className={inputClass} /></Field></div>
        <Field label="الوصف"><input name="description" maxLength={500} placeholder="على ماذا صُرف المبلغ؟" className={inputClass} /></Field>
        <button type="submit" disabled={busy || !categoryList.length} className={buttonClass}>حفظ المصروف</button>
      </form>

      <form className={cardClass} onSubmit={(event) => submit(event, "/api/purchases")}>
        <div><h2 className="text-lg font-semibold text-slate-900">شراء مادة للمخزون</h2><p className="mt-1 text-sm text-slate-500">يُسجَّل الشراء وتُضاف الكمية إلى المخزون.</p></div>
        <Field label="المادة *"><select required name="materialId" defaultValue="" className={inputClass}><option value="" disabled>اختر المادة</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        {!materials.length && <p className="text-sm text-amber-700">لا توجد مواد خام بعد. <Link className="font-semibold underline" href="/dashboard/materials/new">إضافة مادة خام</Link></p>}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="الكمية *"><input required name="quantity" type="number" min="0.000001" step="any" inputMode="decimal" placeholder="0" className={inputClass} /></Field><Field label="التكلفة الإجمالية (EGP) *"><input required name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" className={inputClass} /></Field></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="تاريخ الشراء *"><input required name="date" type="date" defaultValue={new Date().toLocaleDateString("en-CA")} className={inputClass} /></Field><Field label="رقم الفاتورة (اختياري)"><input name="reference" placeholder="رقم أو مرجع الفاتورة" className={inputClass} /></Field></div>
        <button type="submit" disabled={busy || !materials.length} className={buttonClass}>تسجيل الشراء</button>
      </form>
    </div>
    <form className={cardClass} onSubmit={(event) => submit(event, "/api/expenses/categories")}>
      <div><h2 className="text-lg font-semibold text-slate-900">فئات المصروفات</h2><p className="mt-1 text-sm text-slate-500">مثل الإيجار أو الشحن أو التسويق.</p></div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><Field label="اسم الفئة"><input required name="name" maxLength={100} placeholder="اسم الفئة الجديدة" className={inputClass} /></Field></div><button type="submit" disabled={busy} className={buttonClass}>إضافة الفئة</button></div>
      {categoryList.length > 0 && <div className="flex flex-wrap gap-2">{categoryList.map((item) => <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">{item.name}</span>)}</div>}
    </form>
  </div>;
}
