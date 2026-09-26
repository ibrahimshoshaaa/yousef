"use client";

import Link from "next/link";
import { useRef, useState } from "react";

const otherPeriods = [["7d", "آخر ٧ أيام"], ["30d", "آخر ٣٠ يوم"], ["month", "هذا الشهر"], ["lastMonth", "الشهر الماضي"]];
const button = "flex min-h-10 items-center justify-center rounded-xl border px-2 py-2 text-center text-xs transition sm:text-sm";
const active = "border-[#315b4c] bg-[#eaf2ed] font-bold text-[#263b35]";
const inactive = "border-slate-200 bg-white text-slate-600 hover:border-[#315b4c]";

export function RangeFilter({ base, period, from, to }: { base: string; period: string; from?: string; to?: string }) {
  const [pending, setPending] = useState<{ original: string; target: string } | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const selected = pending?.original === period ? pending.target : period;
  const chosen = otherPeriods.find(([key]) => key === selected)?.[1];
  const choose = (key: string) => { setPending({ original: period, target: key }); if (menu.current) menu.current.open = false; };
  return <div className="grid grid-cols-3 gap-2">
    <Link href={`${base}?period=today`} onClick={() => choose("today")} aria-current={selected === "today" ? "page" : undefined} className={`${button} ${selected === "today" ? active : inactive}`}>اليوم</Link>
    <Link href={`${base}?period=yesterday`} onClick={() => choose("yesterday")} aria-current={selected === "yesterday" ? "page" : undefined} className={`${button} ${selected === "yesterday" ? active : inactive}`}>أمس</Link>
    <details ref={menu} className="group relative min-w-0">
      <summary className={`${button} cursor-pointer list-none gap-1 marker:hidden [&::-webkit-details-marker]:hidden ${chosen || selected === "custom" ? active : inactive}`}><span className="truncate">{chosen ?? (selected === "custom" ? "فترة مخصصة" : "فترات أخرى")}</span><span aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180">⌄</span></summary>
      <div className="fixed inset-x-4 top-[20dvh] z-50 mx-auto max-h-[70dvh] w-auto max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl sm:top-[25dvh]">
        <nav className="grid grid-cols-2 gap-2" aria-label="فترات أخرى">{otherPeriods.map(([key, label]) => <Link key={key} href={`${base}?period=${key}`} onClick={() => choose(key)} aria-current={selected === key ? "page" : undefined} className={`${button} ${selected === key ? active : inactive}`}>{label}</Link>)}</nav>
        <form method="GET" action={base} className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
          <input type="hidden" name="period" value="custom" />
          <p className="font-semibold text-[#263b35]">فترة مخصصة</p>
          <div className="grid grid-cols-2 gap-2"><label className="min-w-0 text-slate-600">من<input required type="date" name="from" defaultValue={from} className="mt-1 block w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-900" /></label><label className="min-w-0 text-slate-600">إلى<input required type="date" name="to" defaultValue={to} className="mt-1 block w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-900" /></label></div>
          <button className="w-full rounded-lg bg-[#263b35] px-3 py-2 font-medium text-white">تطبيق</button>
        </form>
      </div>
    </details>
    {selected !== period && <p role="status" className="col-span-3 text-xs text-slate-500">جارٍ تحميل بيانات الفترة المختارة…</p>}
  </div>;
}
