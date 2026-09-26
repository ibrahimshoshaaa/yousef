export default function DashboardLoading() {
  return <main role="status" aria-live="polite" className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-8 sm:py-9">
    <div className="h-9 w-44 animate-pulse rounded-xl bg-slate-200" />
    <div className="grid grid-cols-2 gap-3"><div className="h-24 animate-pulse rounded-2xl bg-slate-200" /><div className="h-24 animate-pulse rounded-2xl bg-slate-200" /></div>
    <div className="h-56 animate-pulse rounded-2xl bg-slate-200" />
    <p className="text-center text-sm text-slate-500">جارٍ تحميل الصفحة…</p>
  </main>;
}
