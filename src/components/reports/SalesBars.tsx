export function SalesBars({ days, currency }: { days: { date: string; gross: number; net: number }[]; currency: string }) {
  const max = Math.max(1, ...days.map(day => day.net));
  if (!days.length) return <p className="text-sm text-gray-500">لا توجد مبيعات في الفترة المختارة.</p>;
  return <div className="max-h-80 min-w-0 space-y-3 overflow-y-auto">{days.map(day => <div key={day.date} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs sm:grid-cols-[6rem_minmax(0,1fr)_7rem]"><span className="text-gray-600">{day.date}</span><div className="order-3 col-span-2 h-3 min-w-0 rounded bg-gray-100 sm:order-none sm:col-span-1 sm:h-5"><div className="h-full rounded bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, day.net / max * 100))}%` }} /></div><span className="text-left tabular-nums">{day.net.toFixed(2)} {currency}</span></div>)}</div>;
}
