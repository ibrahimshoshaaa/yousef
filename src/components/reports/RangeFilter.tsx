"use client";

import Link from "next/link";
import { useState } from "react";

const periods = [
  ["today", "اليوم"], ["yesterday", "أمس"], ["7d", "آخر ٧ أيام"],
  ["30d", "آخر ٣٠ يوم"], ["month", "هذا الشهر"], ["lastMonth", "الشهر الماضي"],
];

export function RangeFilter({ base, period, from, to }: { base: string; period: string; from?: string; to?: string }) {
  const [pending, setPending] = useState<{ original: string; target: string } | null>(null);
  const selected = pending?.original === period ? pending.target : period;
  return <>
    <nav aria-label="فترة التقرير" className="flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
      {periods.map(([key, label]) => <Link key={key} href={`${base}?period=${key}`}
        onClick={() => setPending({ original: period, target: key })}
        aria-current={selected === key ? "page" : undefined}
        className={`flex min-h-11 shrink-0 snap-start items-center justify-center rounded-xl border px-4 text-sm font-semibold transition ${selected === key ? "border-[#191735] bg-[#191735] text-white" : "border-[#deddea] bg-white text-[#191735] hover:border-[#191735]"}`}>
        {label}
      </Link>)}
      <details className="shrink-0"><summary className={`flex min-h-11 cursor-pointer list-none items-center rounded-xl border px-4 text-sm font-semibold marker:hidden [&::-webkit-details-marker]:hidden ${selected === "custom" ? "border-[#191735] bg-[#191735] text-white" : "border-[#deddea] bg-white text-[#191735]"}`}>فترة مخصصة ⌄</summary>
        <form method="GET" action={base} className="fixed right-4 top-40 z-50 w-[min(24rem,calc(100vw-2rem))] space-y-3 rounded-2xl border border-[#deddea] bg-white p-4 shadow-xl">
          <input type="hidden" name="period" value="custom" />
          <div className="grid grid-cols-2 gap-2 text-xs"><label>من<input required type="date" name="from" defaultValue={from} className="mt-1 block w-full min-w-0 rounded-lg border p-2" /></label><label>إلى<input required type="date" name="to" defaultValue={to} className="mt-1 block w-full min-w-0 rounded-lg border p-2" /></label></div>
          <button className="w-full rounded-xl bg-[#191735] px-3 py-2 text-sm font-semibold text-white">عرض الفترة</button>
        </form>
      </details>
    </nav>
    {selected !== period && <p role="status" className="mt-1 text-xs text-slate-500">جارٍ تحديث بيانات الفترة…</p>}
  </>;
}
