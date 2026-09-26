import Link from "next/link";

const periods = [["today", "اليوم"], ["yesterday", "أمس"], ["7d", "آخر ٧ أيام"], ["30d", "آخر ٣٠ يوم"], ["month", "هذا الشهر"], ["lastMonth", "الشهر الماضي"]];

export function RangeFilter({ base, period, from, to }: { base: string; period: string; from?: string; to?: string }) {
  return <div className="space-y-4">
    <nav className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="تصفية التاريخ">
      {periods.map(([key, label]) => <Link key={key} href={`${base}?period=${key}`} aria-current={period === key ? "page" : undefined} className={`flex min-h-11 items-center justify-center rounded-xl border px-2 py-2 text-center text-xs transition sm:text-sm ${period === key ? "border-[#315b4c] bg-[#eaf2ed] font-bold text-[#263b35]" : "border-slate-200 bg-white text-slate-600 hover:border-[#315b4c]"}`}>{label}</Link>)}
    </nav>
    <details open={period === "custom"} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#263b35]">تحديد فترة مخصصة</summary>
      <form method="GET" action={base} className="mt-4 grid grid-cols-2 items-end gap-3 text-sm sm:flex sm:flex-wrap">
        <input type="hidden" name="period" value="custom" />
        <label className="min-w-0 text-slate-600">من<input required type="date" name="from" defaultValue={from} className="mt-1 block w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 text-slate-900" /></label>
        <label className="min-w-0 text-slate-600">إلى<input required type="date" name="to" defaultValue={to} className="mt-1 block w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 text-slate-900" /></label>
        <button className="col-span-2 rounded-lg bg-[#263b35] px-4 py-2.5 font-medium text-white hover:bg-[#345348] sm:col-span-1">تطبيق</button>
      </form>
    </details>
  </div>;
}
