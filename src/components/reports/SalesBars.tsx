export function SalesBars({ days, currency }: { days: { date: string; gross: number; net: number }[]; currency: string }) {
  const max = Math.max(1, ...days.map(day => day.net));
  if (!days.length) return <p className="text-sm text-gray-500">لا توجد مبيعات في الفترة المختارة.</p>;
  return <div className="max-h-80 space-y-2 overflow-y-auto">{days.map(day => <div key={day.date} className="grid grid-cols-[6rem_1fr_7rem] items-center gap-2 text-xs"><span>{day.date}</span><div className="h-5 rounded bg-gray-100"><div className="h-5 rounded bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, day.net / max * 100))}%` }} /></div><span className="text-left tabular-nums">{day.net.toFixed(2)} {currency}</span></div>)}</div>;
}
