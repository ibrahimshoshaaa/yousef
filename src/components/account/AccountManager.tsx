"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type User = { id: string; name: string; email: string; role: string; status: string };

async function send(path: string, input: object) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "تعذر حفظ البيانات");
  return result;
}

export function AccountManager({ owner }: { owner: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (owner) fetch("/api/mobile/account/users", { cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error("تعذر تحميل المستخدمين"); return response.json(); })
      .then(result => setUsers(result.data)).catch(err => setError(err.message));
  }, [owner]);

  async function submit(event: FormEvent<HTMLFormElement>, path: string) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setError(""); setMessage("");
    if (values.newPassword && values.newPassword !== values.confirmPassword) {
      setError("تأكيد كلمة المرور الجديدة غير مطابق"); return;
    }
    if (values.password && values.password !== values.confirmPassword) {
      setError("تأكيد كلمة مرور الأدمن الجديد غير مطابق"); return;
    }
    delete values.confirmPassword;
    setBusy(true);
    try {
      const result = await send(path, values);
      form.reset();
      if (path.endsWith("/users")) {
        setUsers(current => [...current, result.data]);
        setMessage("تمت إضافة الأدمن. يمكنه تسجيل الدخول بالبريد وكلمة المرور الجديدة.");
      } else setMessage("تم تغيير كلمة المرور وإلغاء جلسات الموبايل السابقة. استخدم الجديدة عند تسجيل الدخول مرة أخرى.");
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر الحفظ"); }
    finally { setBusy(false); }
  }

  const field = "mt-2 block w-full rounded-xl border border-[#deddea] bg-white px-4 py-3 outline-none focus:border-[#191735]";
  return <div className="space-y-6">
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    <section className="rounded-2xl border border-[#e5e4ec] bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-bold">تغيير كلمة المرور</h2>
      <p className="mt-1 text-sm text-slate-500">تحتاج كلمة المرور الحالية. الجديدة ١٢ حرفًا على الأقل.</p>
      <form onSubmit={event => submit(event, "/api/mobile/account/password")} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">كلمة المرور الحالية<input name="currentPassword" type="password" autoComplete="current-password" required className={field} /></label>
        <label className="text-sm font-medium">كلمة المرور الجديدة<input name="newPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required className={field} /></label>
        <label className="text-sm font-medium">تأكيد كلمة المرور الجديدة<input name="confirmPassword" type="password" minLength={12} autoComplete="new-password" required className={field} /></label>
        <button disabled={busy} className="self-end rounded-xl bg-[#191735] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">حفظ كلمة المرور</button>
      </form>
    </section>
    {owner && <section className="rounded-2xl border border-[#e5e4ec] bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-bold">الأدمن والمستخدمون</h2>
      <div className="mt-4 divide-y divide-[#e5e4ec]">{users.map(user => <div key={user.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span><strong>{user.name}</strong><span className="mr-2 text-slate-500" dir="ltr">{user.email}</span></span><span className="text-slate-500">{user.role === "OWNER" ? "أدمن" : user.role} · {user.status === "ACTIVE" ? "نشط" : user.status}</span></div>)}</div>
      <h3 className="mt-6 font-bold">إضافة أدمن بنفس الصلاحيات</h3>
      <form onSubmit={event => submit(event, "/api/mobile/account/users")} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">الاسم<input name="name" required minLength={2} maxLength={80} className={field} /></label>
        <label className="text-sm font-medium">البريد الإلكتروني<input name="email" type="email" autoComplete="off" required className={field} /></label>
        <label className="text-sm font-medium">كلمة مرور الأدمن الجديد<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required className={field} /></label>
        <label className="text-sm font-medium">تأكيد كلمة المرور<input name="confirmPassword" type="password" minLength={12} autoComplete="new-password" required className={field} /></label>
        <label className="text-sm font-medium">كلمة مرورك الحالية لتأكيد العملية<input name="currentPassword" type="password" autoComplete="current-password" required className={field} /></label>
        <button disabled={busy} className="self-end rounded-xl bg-[#191735] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">إضافة الأدمن</button>
      </form>
    </section>}
  </div>;
}
