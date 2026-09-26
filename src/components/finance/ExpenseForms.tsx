"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

type Option = { id: string; name: string };
const inputClass = "mt-2 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#96723c] focus:ring-2 focus:ring-amber-100";
const buttonClass = "rounded-xl bg-[#263b35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#345348] disabled:opacity-50";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0 text-sm font-medium text-slate-700">{label}{children}</label>;
}

export function ExpenseForms({ categories, currency, initialOpen = false }: { categories: Option[]; currency: string; initialOpen?: boolean }) {
  const router = useRouter();
  const expenseDialog = useRef<HTMLDialogElement>(null);
  const openedInitially = useRef(false);
  const categoryDialog = useRef<HTMLDialogElement>(null);
  const [categoryList, setCategoryList] = useState(categories);
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setCategoryList(categories); }, [categories]);
  useEffect(() => { if (initialOpen && !openedInitially.current) { openedInitially.current = true; expenseDialog.current?.showModal(); } }, [initialOpen]);

  function openExpense() {
    setError("");
    expenseDialog.current?.showModal();
  }

  function openCategory() {
    setError("");
    // Only one native modal can be active at a time. Keep the expense form mounted
    // so its entered values are still there when the category dialog closes.
    expenseDialog.current?.close();
    categoryDialog.current?.showModal();
  }

  function backToExpense() {
    categoryDialog.current?.close();
    setError("");
    expenseDialog.current?.showModal();
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, amount: Number(values.amount), date: new Date(String(values.date)).toISOString() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذر حفظ المصروف");
      form.reset();
      setCategoryId("");
      expenseDialog.current?.close();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/expenses/categories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: new FormData(form).get("name") }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذر إضافة الفئة");
      const created: Option = body.data;
      setCategoryList((current) => [...current.filter((item) => item.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name, "ar")));
      setCategoryId(created.id);
      form.reset();
      backToExpense();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء الحفظ");
    } finally {
      setBusy(false);
    }
  }

  const dialogClass = "fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-right shadow-2xl backdrop:bg-slate-950/50";

  return <>
    <button type="button" onClick={openExpense} className={buttonClass}>+ إضافة مصروف</button>
    <dialog ref={expenseDialog} dir="rtl" aria-labelledby="expense-title" className={dialogClass} onClose={() => setError("")}>
      <form onSubmit={submitExpense} className="space-y-5 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h2 id="expense-title" className="text-xl font-bold text-slate-900">إضافة مصروف</h2><p className="mt-1 text-sm text-slate-500">سجّل المصروف في الفئة المناسبة.</p></div><button type="button" aria-label="إغلاق" onClick={() => expenseDialog.current?.close()} className="rounded-lg px-2 text-2xl text-slate-500 hover:bg-slate-100">×</button></div>
        <div><div className="flex items-end justify-between gap-3"><span className="text-sm font-medium text-slate-700">الفئة *</span><button type="button" onClick={openCategory} className="text-sm font-semibold text-[#96723c] hover:underline">+ إضافة فئة</button></div><select required name="categoryId" aria-label="الفئة" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={inputClass}><option value="" disabled>اختر الفئة</option>{categoryList.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        {categoryList.length === 0 && <p className="text-sm text-amber-700">أضف فئة أولًا لتسجيل المصروف.</p>}
        <div className="grid gap-4 sm:grid-cols-2"><Field label={`المبلغ (${currency}) *`}><input required name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" className={inputClass} /></Field><Field label="التاريخ *"><input required name="date" type="date" defaultValue={new Date().toLocaleDateString("en-CA")} className={inputClass} /></Field></div>
        <Field label="الوصف"><input name="description" maxLength={500} placeholder="على ماذا صُرف المبلغ؟" className={inputClass} /></Field>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => expenseDialog.current?.close()} className="rounded-xl border border-slate-200 px-5 py-3 text-sm">إلغاء</button><button type="submit" disabled={busy || !categoryList.length} className={buttonClass}>{busy ? "جارٍ الحفظ..." : "حفظ المصروف"}</button></div>
      </form>
    </dialog>
    <dialog ref={categoryDialog} dir="rtl" aria-labelledby="category-title" className={dialogClass} onClose={() => { if (!expenseDialog.current?.open) expenseDialog.current?.showModal(); }}>
      <form onSubmit={submitCategory} className="space-y-5 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h2 id="category-title" className="text-xl font-bold text-slate-900">إضافة فئة</h2><p className="mt-1 text-sm text-slate-500">مثلاً: الإيجار أو الشحن أو التسويق.</p></div><button type="button" aria-label="رجوع" onClick={backToExpense} className="rounded-lg px-2 text-2xl text-slate-500 hover:bg-slate-100">×</button></div>
        <Field label="اسم الفئة *"><input required autoFocus name="name" maxLength={100} placeholder="اسم الفئة الجديدة" className={inputClass} /></Field>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={backToExpense} className="rounded-xl border border-slate-200 px-5 py-3 text-sm">رجوع</button><button type="submit" disabled={busy} className={buttonClass}>{busy ? "جارٍ الحفظ..." : "إضافة الفئة"}</button></div>
      </form>
    </dialog>
  </>;
}
